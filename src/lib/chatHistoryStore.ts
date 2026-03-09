// Chat History Store — auto-persists chat sessions to localStorage
// Each session is saved/updated after every AI response completes.

import { trashChat } from "./trashStore";

export interface ChatSession {
  id: string;
  characterId: string;
  characterEmoji: string;
  characterName: string;
  messages: Array<{ role: string; text: string }>;
  startedAt: string;   // ISO string
  updatedAt: string;   // ISO string
  title: string;       // derived from first user message
}

const STORAGE_KEY = "chat-history";
const MAX_SESSIONS = 50;

export function getSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Insert or update a session by id. Newest sessions float to the top. */
export function upsertSession(session: ChatSession): void {
  const sessions = getSessions().filter((s) => s.id !== session.id);
  sessions.unshift(session);
  // Cap at MAX_SESSIONS
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
}

export function deleteSession(id: string): void {
  const sessions = getSessions();
  const target = sessions.find((s) => s.id === id);
  // Soft-delete: move to trash before removing
  if (target) {
    try { trashChat(target); } catch { /* ignore */ }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.filter((s) => s.id !== id)));
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Generate a short title from the first user message (sync fallback) */
export function sessionTitle(messages: Array<{ role: string; text: string }>): string {
  const first = messages.find((m) => m.role === "user");
  if (!first?.text) return "Chat session";
  const words = first.text.trim().split(/\s+/).slice(0, 7).join(" ");
  return words.length < first.text.trim().length ? `${words}\u2026` : words;
}

/** Ask the backend LLM to generate a short descriptive title (3-6 words). */
export async function generateAITitle(
  messages: Array<{ role: string; text: string }>,
  agentName: string = "AI"
): Promise<string> {
  try {
    const res = await fetch("/api/generate-title", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, agent_name: agentName }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.title || sessionTitle(messages);
  } catch {
    return sessionTitle(messages);
  }
}

/** Update the title of an existing session by id. */
export function updateSessionTitle(sessionId: string, title: string): void {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx >= 0) {
    sessions[idx].title = title;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }
}
