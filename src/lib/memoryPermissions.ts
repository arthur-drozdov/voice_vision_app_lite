/**
 * Memory Permissions Store
 *
 * Central state manager for the Trust & Memory ecosystem.
 * Stores 5 granular category toggles + a global pause flag.
 * All data lives in localStorage under "memory-permissions".
 *
 * Backend logic MUST call `isMemoryAllowed(category)` before
 * writing any user data to the database.
 */

/* ─── Types ───────────────────────────────────────────────────────────────── */

export type MemoryCategory =
  | "preferences"
  | "emotions"
  | "goals"
  | "wellness"
  | "creative";

export interface MemoryPermissions {
  preferences: boolean;  // Music, news, content styles
  emotions: boolean;     // Mood shifts, stress patterns
  goals: boolean;        // Deadlines, projects, creative ideas
  wellness: boolean;     // Routines, meditation (sensitive)
  creative: boolean;     // Interests, inspiration
  paused: boolean;       // Global pause — stops all tracking without deleting data
  onboardingComplete: boolean; // Has the user seen the consent modal?
}

/* ─── Category metadata (for UI rendering) ────────────────────────────────── */

export interface CategoryInfo {
  key: MemoryCategory;
  label: string;
  description: string;
  emoji: string;
  sensitive?: boolean;
  preview: string; // Mock example of what would be remembered
}

export const MEMORY_CATEGORIES: CategoryInfo[] = [
  {
    key: "preferences",
    label: "Personal Preferences",
    emoji: "🎵",
    description: "Remember your favourite music, news sources, and content styles.",
    preview: "\"Szonja prefers lo-fi beats while working and reads tech news in the morning.\"",
  },
  {
    key: "emotions",
    label: "Emotional Patterns",
    emoji: "💜",
    description: "Remember your mood shifts to offer better support when you need it.",
    preview: "\"Szonja tends to feel more creative in the evenings and prefers calm energy on Mondays.\"",
  },
  {
    key: "goals",
    label: "Life Goals & Projects",
    emoji: "🎯",
    description: "Remember your long-term projects, deadlines, and creative ideas.",
    preview: "\"Szonja is building an AI companion app with a launch target in April.\"",
  },
  {
    key: "wellness",
    label: "Health & Wellness",
    emoji: "🧘",
    description: "Remember your wellness routines, meditation preferences, and health reminders.",
    sensitive: true,
    preview: "\"Szonja meditates for 10 minutes each morning and prefers guided breathing exercises.\"",
  },
  {
    key: "creative",
    label: "Creative Spark",
    emoji: "✨",
    description: "Remember your creative interests to suggest new ideas and inspiration.",
    preview: "\"Szonja loves generative art, enjoys writing prompts, and is inspired by nature photography.\"",
  },
];

/* ─── Storage helpers ─────────────────────────────────────────────────────── */

const STORAGE_KEY = "memory-permissions";

const DEFAULTS: MemoryPermissions = {
  preferences: false,
  emotions: false,
  goals: false,
  wellness: false,
  creative: false,
  paused: false,
  onboardingComplete: false,
};

/** Load permissions from localStorage */
export function getPermissions(): MemoryPermissions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

/** Save permissions to localStorage */
export function savePermissions(perms: MemoryPermissions): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(perms));
}

/** Update a single category toggle */
export function setCategory(category: MemoryCategory, enabled: boolean): void {
  const perms = getPermissions();
  perms[category] = enabled;
  savePermissions(perms);
}

/** Toggle the global pause flag */
export function togglePauseAll(): boolean {
  const perms = getPermissions();
  perms.paused = !perms.paused;
  savePermissions(perms);
  return perms.paused;
}

/** Set pause state directly */
export function setPaused(paused: boolean): void {
  const perms = getPermissions();
  perms.paused = paused;
  savePermissions(perms);
}

/** Mark onboarding as complete */
export function completeOnboarding(): void {
  const perms = getPermissions();
  perms.onboardingComplete = true;
  savePermissions(perms);
}

/* ─── Query helpers ───────────────────────────────────────────────────────── */

/**
 * Check if the AI is allowed to store/retrieve data for a category.
 * Returns false if:
 *   1. Global pause is active, OR
 *   2. The specific category toggle is off
 */
export function isMemoryAllowed(category: MemoryCategory): boolean {
  const perms = getPermissions();
  if (perms.paused) return false;
  return perms[category] === true;
}

/** Has the user completed the Trust & Memory onboarding? */
export function hasCompletedOnboarding(): boolean {
  return getPermissions().onboardingComplete;
}

/** Get count of enabled categories */
export function enabledCount(): number {
  const perms = getPermissions();
  return MEMORY_CATEGORIES.filter((c) => perms[c.key]).length;
}

/** Get list of enabled category keys */
export function enabledCategories(): MemoryCategory[] {
  const perms = getPermissions();
  return MEMORY_CATEGORIES.filter((c) => perms[c.key]).map((c) => c.key);
}
