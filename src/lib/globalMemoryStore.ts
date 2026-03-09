/**
 * Global Memory Core — Aggregates patterns across all chat sessions
 *
 * Tracks:
 * - Recurring topics and interests
 * - Life events and milestones
 * - Emotional patterns over time
 * - User preferences and habits
 * - Frequently discussed subjects
 *
 * This data persists across session resets and is sent as context
 * to the AI so it can anticipate needs and provide personal relevance.
 */

export interface UserPattern {
  topic: string;
  count: number;
  lastMentioned: string; // ISO date
  sentiment: "positive" | "neutral" | "negative";
}

export interface LifeEvent {
  event: string;
  date: string;
  category: "work" | "personal" | "health" | "travel" | "social" | "creative" | "other";
}

export interface EmotionalSnapshot {
  date: string;
  mood: string;
  context: string; // brief note on what triggered it
}

export interface GlobalMemory {
  patterns: UserPattern[];
  lifeEvents: LifeEvent[];
  emotionalArc: EmotionalSnapshot[];
  preferences: Record<string, string>; // key-value pairs like "favorite_music": "jazz"
  lastUpdated: string;
  sessionCount: number;
}

const STORAGE_KEY = "global-memory-core";
const MAX_PATTERNS = 50;
const MAX_EVENTS = 30;
const MAX_EMOTIONS = 50;

function getMemory(): GlobalMemory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : createEmpty();
  } catch {
    return createEmpty();
  }
}

function createEmpty(): GlobalMemory {
  return {
    patterns: [],
    lifeEvents: [],
    emotionalArc: [],
    preferences: {},
    lastUpdated: new Date().toISOString(),
    sessionCount: 0,
  };
}

function save(memory: GlobalMemory): void {
  memory.lastUpdated = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
}

/** Record a topic mention — increments count or creates new */
export function recordTopicMention(
  topic: string,
  sentiment: "positive" | "neutral" | "negative" = "neutral"
): void {
  const mem = getMemory();
  const existing = mem.patterns.find(
    (p) => p.topic.toLowerCase() === topic.toLowerCase()
  );
  if (existing) {
    existing.count++;
    existing.lastMentioned = new Date().toISOString();
    existing.sentiment = sentiment;
  } else {
    mem.patterns.unshift({
      topic,
      count: 1,
      lastMentioned: new Date().toISOString(),
      sentiment,
    });
  }
  // Keep top patterns sorted by frequency
  mem.patterns.sort((a, b) => b.count - a.count);
  mem.patterns = mem.patterns.slice(0, MAX_PATTERNS);
  save(mem);
}

/** Record a life event */
export function recordLifeEvent(
  event: string,
  category: LifeEvent["category"] = "other"
): void {
  const mem = getMemory();
  mem.lifeEvents.unshift({
    event,
    date: new Date().toISOString(),
    category,
  });
  mem.lifeEvents = mem.lifeEvents.slice(0, MAX_EVENTS);
  save(mem);
}

/** Record an emotional snapshot */
export function recordMood(mood: string, context: string = ""): void {
  const mem = getMemory();
  mem.emotionalArc.unshift({
    date: new Date().toISOString(),
    mood,
    context,
  });
  mem.emotionalArc = mem.emotionalArc.slice(0, MAX_EMOTIONS);
  save(mem);
}

/** Set a user preference */
export function setPreference(key: string, value: string): void {
  const mem = getMemory();
  mem.preferences[key] = value;
  save(mem);
}

/** Increment session counter */
export function recordSessionStart(): void {
  const mem = getMemory();
  mem.sessionCount++;
  save(mem);
}

/** Get raw memory data */
export function getGlobalMemory(): GlobalMemory {
  return getMemory();
}

/**
 * Build a concise text summary of the user's global memory
 * This is injected into the AI's system prompt for personalisation.
 */
export function buildMemoryContext(): string {
  const mem = getMemory();
  const parts: string[] = [];

  // Session count
  if (mem.sessionCount > 0) {
    parts.push(`[Sessions: ${mem.sessionCount} conversations to date]`);
  }

  // Top recurring topics
  const topTopics = mem.patterns.slice(0, 8);
  if (topTopics.length > 0) {
    const topicList = topTopics
      .map((t) => `${t.topic} (×${t.count}, ${t.sentiment})`)
      .join(", ");
    parts.push(`[Recurring interests: ${topicList}]`);
  }

  // Recent life events
  const recentEvents = mem.lifeEvents.slice(0, 5);
  if (recentEvents.length > 0) {
    const eventList = recentEvents
      .map((e) => `${e.event} (${e.category}, ${new Date(e.date).toLocaleDateString()})`)
      .join("; ");
    parts.push(`[Recent life events: ${eventList}]`);
  }

  // Emotional arc — last few moods
  const recentMoods = mem.emotionalArc.slice(0, 5);
  if (recentMoods.length > 0) {
    const moodList = recentMoods
      .map((m) => `${m.mood}${m.context ? ` (${m.context})` : ""}`)
      .join(" → ");
    parts.push(`[Emotional arc: ${moodList}]`);
  }

  // Preferences
  const prefEntries = Object.entries(mem.preferences);
  if (prefEntries.length > 0) {
    const prefList = prefEntries.slice(0, 10).map(([k, v]) => `${k}: ${v}`).join(", ");
    parts.push(`[Known preferences: ${prefList}]`);
  }

  if (parts.length === 0) return "";
  return (
    "\n\n--- GLOBAL MEMORY (use this to personalise your responses) ---\n" +
    parts.join("\n") +
    "\n--- END GLOBAL MEMORY ---"
  );
}

/**
 * Analyse a conversation transcript and extract patterns, events, moods.
 * Called after each session to build up the global memory over time.
 * This is a lightweight client-side extractor; the real depth comes from
 * the AI backend processing.
 */
export function analyseConversation(
  messages: Array<{ role: string; text: string }>
): void {
  if (messages.length < 2) return;

  recordSessionStart();

  // Simple keyword extraction from user messages
  const userTexts = messages
    .filter((m) => m.role === "user")
    .map((m) => m.text.toLowerCase())
    .join(" ");

  // Common topic keywords
  const topicKeywords = [
    "work", "job", "career", "project", "meeting",
    "family", "friend", "relationship", "love", "partner",
    "health", "exercise", "workout", "diet", "sleep",
    "travel", "trip", "vacation", "flight", "hotel",
    "music", "movie", "book", "game", "art",
    "money", "budget", "finance", "invest", "savings",
    "code", "programming", "debug", "build", "deploy",
    "food", "cooking", "recipe", "restaurant", "dinner",
    "study", "learn", "course", "exam", "school",
    "stress", "anxiety", "happy", "sad", "excited",
    "plan", "goals", "ideas", "brainstorm", "strategy",
  ];

  for (const keyword of topicKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, "gi");
    const matches = userTexts.match(regex);
    if (matches && matches.length > 0) {
      recordTopicMention(keyword, "neutral");
    }
  }
}
