/**
 * Memory Sync — Bridges localStorage to DynamoDB via WebSocket
 *
 * Flow:
 *  1. On app load → fetch memories from DynamoDB → hydrate localStorage
 *  2. After each chat → auto-save session + patterns → DynamoDB
 *  3. On preference change → sync to DynamoDB
 *
 * Uses the existing WebSocket connection (GatewayClient) for all operations.
 * No extra API calls or endpoints needed.
 */

import type { GlobalMemory, UserPattern, LifeEvent } from "./globalMemoryStore";
import type { ChatSession } from "./chatHistoryStore";

type MemoryType = "session" | "global" | "preferences";

interface MemoryPayload {
  memoryType: MemoryType;
  data: Record<string, unknown>;
  memoryId?: string;
  userId?: string;
}

interface MemoryItem {
  memoryId: string;
  userId: string;
  data: Record<string, unknown>;
  updatedAt: string;
}

// Cache the userId for the session
let _userId: string | null = null;

function getUserId(): string {
  if (_userId) return _userId;
  const stored = localStorage.getItem("vv-user-id");
  if (stored) {
    _userId = stored;
    return stored;
  }
  _userId = crypto.randomUUID();
  localStorage.setItem("vv-user-id", _userId);
  return _userId;
}

/**
 * Send a memory command through the WebSocket.
 * Requires an active GatewayClient connection.
 */
function sendMemory(
  type: string,
  payload: MemoryPayload,
  wsSend: (data: Record<string, unknown>) => void
): void {
  wsSend({
    type,
    userId: getUserId(),
    ...payload,
  });
}

// ─── Public API ────────────────────────────────────────

/**
 * Fetch all memories for the current user from DynamoDB.
 * Call on app load. Returns parsed memories keyed by type.
 */
export function fetchMemories(
  wsSend: (data: Record<string, unknown>) => void,
  onComplete: (data: { sessions: ChatSession[]; globalMemory: GlobalMemory | null; preferences: Record<string, string> }) => void,
  memoryType: "all" | "session" | "global" | "preferences" = "all"
): void {
  // We use a one-shot listener pattern — the GatewayClient event system
  // should route 'memory_list' responses back to us.
  // For now, we send the request; the caller wires up the response handler.
  wsSend({
    type: "memory_get",
    userId: getUserId(),
    memoryType,
  });
}

/**
 * Save a chat session to DynamoDB.
 * Call after each AI response completes.
 */
export function syncChatSession(
  session: ChatSession,
  wsSend: (data: Record<string, unknown>) => void
): void {
  sendMemory("memory_add", {
    memoryType: "session",
    memoryId: `session#${session.id}`,
    data: session as unknown as Record<string, unknown>,
  }, wsSend);
}

/**
 * Save the global memory aggregate to DynamoDB.
 * Call after analyseConversation() updates the global memory.
 */
export function syncGlobalMemory(
  memory: GlobalMemory,
  wsSend: (data: Record<string, unknown>) => void
): void {
  sendMemory("memory_add", {
    memoryType: "global",
    memoryId: "global#current",
    data: memory as unknown as Record<string, unknown>,
  }, wsSend);
}

/**
 * Save user preferences to DynamoDB.
 */
export function syncPreferences(
  preferences: Record<string, string>,
  wsSend: (data: Record<string, unknown>) => void
): void {
  sendMemory("memory_add", {
    memoryType: "preferences",
    memoryId: "preferences#current",
    data: preferences as unknown as Record<string, unknown>,
  }, wsSend);
}

/**
 * Delete a memory by ID.
 */
export function deleteMemory(
  memoryId: string,
  wsSend: (data: Record<string, unknown>) => void
): void {
  sendMemory("memory_delete", {
    memoryType: "session",
    memoryId,
    data: {},
  }, wsSend);
}

/**
 * Hydrate localStorage from a memory_list response.
 * Call this when GatewayClient receives a memory_list message.
 */
export function hydrateFromMemoryList(memories: MemoryItem[]): {
  sessions: ChatSession[];
  globalMemory: GlobalMemory | null;
  preferences: Record<string, string>;
} {
  const sessions: ChatSession[] = [];
  let globalMemory: GlobalMemory | null = null;
  let preferences: Record<string, string> = {};

  for (const mem of memories) {
    const { memoryId, data } = mem;
    try {
      if (memoryId.startsWith("session#")) {
        sessions.push(data as unknown as ChatSession);
      } else if (memoryId.startsWith("global#")) {
        globalMemory = data as unknown as GlobalMemory;
      } else if (memoryId.startsWith("preferences#")) {
        preferences = data as unknown as Record<string, string>;
      }
    } catch (e) {
      console.warn("Failed to parse memory:", memoryId, e);
    }
  }

  // Write to localStorage
  if (sessions.length > 0) {
    localStorage.setItem("chat-history", JSON.stringify(sessions));
  }
  if (globalMemory) {
    localStorage.setItem("global-memory-core", JSON.stringify(globalMemory));
  }
  if (Object.keys(preferences).length > 0) {
    localStorage.setItem("vv-preferences", JSON.stringify(preferences));
  }

  return { sessions, globalMemory, preferences };
}

/**
 * Build the memory context string for AI system prompts.
 * Uses localStorage (which may have been hydrated from DynamoDB).
 */
export function buildMemoryContext(): string {
  const parts: string[] = [];

  try {
    const raw = localStorage.getItem("global-memory-core");
    if (raw) {
      const mem: GlobalMemory = JSON.parse(raw);
      if (mem.sessionCount > 0) {
        parts.push(`[Sessions: ${mem.sessionCount} conversations]`);
      }
      const topTopics = (mem.patterns || []).slice(0, 6);
      if (topTopics.length > 0) {
        parts.push(`[Topics: ${topTopics.map(t => t.topic).join(", ")}]`);
      }
      const recentEvents = (mem.lifeEvents || []).slice(0, 3);
      if (recentEvents.length > 0) {
        parts.push(`[Life: ${recentEvents.map(e => e.event).join("; ")}]`);
      }
      const prefs = Object.entries(mem.preferences || {}).slice(0, 5);
      if (prefs.length > 0) {
        parts.push(`[Prefs: ${prefs.map(([k,v]) => `${k}:${v}`).join(", ")}]`);
      }
    }
  } catch { /* ignore */ }

  if (parts.length === 0) return "";
  return "\n\n--- USER MEMORY ---\n" + parts.join("\n") + "\n--- END MEMORY ---";
}

export { getUserId };
export type { MemoryItem, MemoryPayload, MemoryType };
