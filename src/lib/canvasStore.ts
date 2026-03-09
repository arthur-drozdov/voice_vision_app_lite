// Canvas Store — persists session boards to localStorage
import { trashBoard } from "./trashStore";

export type CanvasFormat = "mindmap" | "summary" | "calendar" | "todo" | "table";
export type GenerationStatus = "pending" | "generating" | "ready" | "error";

export interface FormatOption {
  id: CanvasFormat;
  icon: string;
  label: string;
  description: string;
}

export const FORMAT_OPTIONS: FormatOption[] = [
  { id: "mindmap",  icon: "🗺️", label: "Mindmap",          description: "Visual idea map with branches" },
  { id: "summary",  icon: "📝", label: "Text Summary",      description: "Key points, clean paragraphs" },
  { id: "table",    icon: "📊", label: "Comparison Table",  description: "Side-by-side comparison grid" },
  { id: "calendar", icon: "📅", label: "Calendar",          description: "Dates, events & reminders" },
  { id: "todo",     icon: "✅", label: "To-Do List",        description: "Action items & tasks" },
];

export interface CanvasMessage {
  role: string;
  text: string;
}

// Structured data shapes returned by /generate-canvas
export interface MindmapNode {
  id?: string;
  label: string;
  children?: MindmapNode[];
}

export interface TodoItem {
  text: string;
  done: boolean;
  priority: "high" | "medium" | "low";
}

export type ReminderTime = "start" | "1hr" | "1day" | "custom" | null;

export interface CalendarItem {
  date: string;
  title: string;
  description?: string;
  reminder?: ReminderTime;
  customReminderMinutes?: number;
}

export type StructuredData =
  | { type: "mindmap"; root: MindmapNode }
  | { type: "todo"; items: TodoItem[] }
  | { type: "calendar"; events: CalendarItem[] }
  | null;

export interface CanvasBoard {
  id: string;
  title: string;
  characterId: string;
  characterEmoji: string;
  characterName: string;
  format: CanvasFormat;
  createdAt: string; // ISO string
  messages: CanvasMessage[];
  // AI generation fields
  generationStatus: GenerationStatus;
  generatedContent?: string;   // markdown / raw text from AI
  structuredData?: StructuredData; // parsed JSON for mindmap/todo/calendar
  customDescription?: string;  // user's description for "custom" format
}

const STORAGE_KEY = "canvas-boards";

export function getBoards(): CanvasBoard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const boards = JSON.parse(raw) as CanvasBoard[];
    // Ensure legacy boards without generationStatus get a value
    return boards.map((b) => ({
      ...b,
      generationStatus: b.generationStatus ?? "ready",
    }));
  } catch {
    return [];
  }
}

export function saveBoard(board: CanvasBoard): void {
  const boards = getBoards();
  boards.unshift(board); // newest first
  localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
}

export function updateBoard(id: string, partial: Partial<CanvasBoard>): void {
  const boards = getBoards().map((b) =>
    b.id === id ? { ...b, ...partial } : b
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
}

export function deleteBoard(id: string): void {
  const boards = getBoards();
  const target = boards.find((b) => b.id === id);
  // Soft-delete: move to trash before removing
  if (target) {
    try { trashBoard(target); } catch { /* ignore */ }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(boards.filter((b) => b.id !== id)));
}

/** Merge additional messages into an existing board and reset generation status */
export function mergeIntoBoard(id: string, newMessages: CanvasMessage[]): void {
  const boards = getBoards().map((b) => {
    if (b.id !== id) return b;
    return {
      ...b,
      messages: [...b.messages, ...newMessages],
      generationStatus: "pending" as GenerationStatus,
      generatedContent: undefined,
      structuredData: undefined,
    };
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
}

/** Generate a short human-readable title from the first user message + date */
export function generateBoardTitle(
  messages: CanvasMessage[],
  _characterName: string,
  date: Date
): string {
  const firstUser = messages.find((m) => m.role === "user");
  let topic = "Conversation";
  if (firstUser?.text) {
    const words = firstUser.text.trim().split(/\s+/).slice(0, 6).join(" ");
    topic =
      words.length < firstUser.text.trim().length ? `${words}…` : words;
  }
  const dateStr = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${topic} — ${dateStr}`;
}
