/**
 * Trash Store — Soft-delete bin for chat sessions and canvas boards
 *
 * Items moved here stay for 30 days before auto-purging.
 * Users can restore items at any time within the retention window.
 */

import type { ChatSession } from "./chatHistoryStore";
import type { CanvasBoard } from "./canvasStore";

export interface TrashedItem<T> {
  id: string;
  type: "chat" | "canvas";
  data: T;
  deletedAt: string; // ISO string
}

const TRASH_KEY = "deleted-items-trash";
const RETENTION_DAYS = 30;

function getRawTrash(): TrashedItem<any>[] {
  try {
    const raw = localStorage.getItem(TRASH_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTrash(items: TrashedItem<any>[]): void {
  localStorage.setItem(TRASH_KEY, JSON.stringify(items));
}

/** Purge items older than 30 days */
function autoPurge(items: TrashedItem<any>[]): TrashedItem<any>[] {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return items.filter((item) => new Date(item.deletedAt).getTime() > cutoff);
}

/** Get all trashed items (auto-purges expired ones) */
export function getTrash(): TrashedItem<any>[] {
  const items = getRawTrash();
  const purged = autoPurge(items);
  if (purged.length !== items.length) saveTrash(purged);
  return purged;
}

/** Get trashed chat sessions */
export function getTrashedChats(): TrashedItem<ChatSession>[] {
  return getTrash().filter((i) => i.type === "chat") as TrashedItem<ChatSession>[];
}

/** Get trashed canvas boards */
export function getTrashedBoards(): TrashedItem<CanvasBoard>[] {
  return getTrash().filter((i) => i.type === "canvas") as TrashedItem<CanvasBoard>[];
}

/** Move a chat session to trash */
export function trashChat(session: ChatSession): void {
  const items = getTrash();
  items.unshift({
    id: session.id,
    type: "chat",
    data: session,
    deletedAt: new Date().toISOString(),
  });
  saveTrash(items);
}

/** Move a canvas board to trash */
export function trashBoard(board: CanvasBoard): void {
  const items = getTrash();
  items.unshift({
    id: board.id,
    type: "canvas",
    data: board,
    deletedAt: new Date().toISOString(),
  });
  saveTrash(items);
}

/** Restore a trashed item by id — returns the item data */
export function restoreFromTrash(id: string): TrashedItem<any> | null {
  const items = getTrash();
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  const [restored] = items.splice(idx, 1);
  saveTrash(items);
  return restored;
}

/** Permanently delete from trash */
export function permanentlyDelete(id: string): void {
  const items = getTrash().filter((i) => i.id !== id);
  saveTrash(items);
}

/** Empty the entire trash */
export function emptyTrash(): void {
  localStorage.removeItem(TRASH_KEY);
}

/** Count of items in trash */
export function trashCount(): number {
  return getTrash().length;
}

/** Days remaining before an item is auto-purged */
export function daysUntilPurge(deletedAt: string): number {
  const elapsed = Date.now() - new Date(deletedAt).getTime();
  const remaining = RETENTION_DAYS - Math.floor(elapsed / (24 * 60 * 60 * 1000));
  return Math.max(0, remaining);
}

/**
 * Export all user data as a JSON blob (for backup).
 * Includes chat sessions, canvas boards, and trashed items.
 */
export function exportAllData(): string {
  const data = {
    exportedAt: new Date().toISOString(),
    chatSessions: (() => {
      try { return JSON.parse(localStorage.getItem("chat-history") ?? "[]"); } catch { return []; }
    })(),
    canvasBoards: (() => {
      try { return JSON.parse(localStorage.getItem("canvas-boards") ?? "[]"); } catch { return []; }
    })(),
    trashedItems: getTrash(),
    settings: (() => {
      try { return JSON.parse(localStorage.getItem("customize-settings") ?? "{}"); } catch { return {}; }
    })(),
  };
  return JSON.stringify(data, null, 2);
}

/** Download data as a JSON file */
export function downloadBackup(): void {
  const json = exportAllData();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ai-companion-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
