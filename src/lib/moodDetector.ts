/**
 * Mood Detector
 *
 * Derives the AI character's current "mood" from app state and response content.
 * The mood drives the animated ring on the character avatar.
 */

export type MoodType =
  | "idle"        // waiting, soft breathe
  | "thinking"    // processing, blue/cyan spinning arc
  | "talking"     // streaming response, green ripples
  | "excited"     // upbeat content, fast yellow pulse
  | "empathetic"  // emotional/supportive content, purple glow (Luna especially)
  | "focused"     // technical/code content, white dash spin (Kai especially)
  | "barge-in";   // user interrupted, red flash

// ── Content keyword maps ──────────────────────────────────────────────────────

const EXCITED_KEYWORDS = [
  "great", "amazing", "fantastic", "love it", "wonderful", "excellent",
  "perfect", "awesome", "brilliant", "wow", "incredible", "exciting",
  "congratulations", "nice", "well done", "yes!", "absolutely!", "let's go",
];

const EMPATHETIC_KEYWORDS = [
  "understand", "i hear you", "that sounds", "i'm sorry", "feel",
  "here for you", "difficult", "hard time", "emotions", "support",
  "listen", "sad", "anxious", "worried", "pain", "struggle", "tough",
  "not easy", "must be", "take care", "breathe", "together",
];

const FOCUSED_KEYWORDS = [
  "function", "error", "debug", "const ", "let ", "var ",
  "return ", "async", "await", "class ", "import ", "export ",
  "```", "algorithm", "syntax", "implement", "stack", "loop",
  "array", "object", "type ", "interface ", "null", "undefined",
];

/**
 * Scan the last AI response text and determine a content-driven mood.
 * Character-specific rules are applied first, then universal ones.
 */
export function detectContentMood(text: string, characterId: string): MoodType {
  const lower = text.toLowerCase();

  // Luna is empathetic by nature — check empathy first
  if (characterId === "luna") {
    if (EMPATHETIC_KEYWORDS.some((kw) => lower.includes(kw))) return "empathetic";
  }

  // Kai is focused on technical content
  if (characterId === "kai") {
    if (FOCUSED_KEYWORDS.some((kw) => lower.includes(kw))) return "focused";
  }

  // Universal: check excitement first (positive energy)
  if (EXCITED_KEYWORDS.some((kw) => lower.includes(kw))) return "excited";

  // Universal: empathetic/supportive language
  if (EMPATHETIC_KEYWORDS.some((kw) => lower.includes(kw))) return "empathetic";

  // Universal: technical/code content
  if (FOCUSED_KEYWORDS.some((kw) => lower.includes(kw))) return "focused";

  return "idle";
}

/**
 * Derive current mood from live app state (Chat mode).
 */
export function deriveChatMood(params: {
  isGenerating: boolean;
  hasStartedStreaming: boolean;
  isBarging: boolean;
  contentMood: MoodType;
}): MoodType {
  if (params.isBarging) return "barge-in";
  if (params.isGenerating && !params.hasStartedStreaming) return "thinking";
  if (params.isGenerating && params.hasStartedStreaming) return "talking";
  return params.contentMood; // "idle" or content-driven for ~3s after response
}

/**
 * Derive current mood from live app state (Video mode).
 */
export function deriveVideoMood(params: {
  isBarging: boolean;
  isTTSActive: boolean;
  isUserSpeaking: boolean;
  isActive: boolean;
}): MoodType {
  if (!params.isActive) return "idle";
  if (params.isBarging) return "barge-in";
  if (params.isTTSActive) return "talking";
  if (!params.isUserSpeaking && params.isActive) return "thinking";
  return "idle";
}
