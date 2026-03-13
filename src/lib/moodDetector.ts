/**
 * Mood Detector
 *
 * Derives the AI character's current "mood" from app state and response content,
 * AND detects the user's emotional state from their messages to guide AI adaptation.
 */

export type MoodType =
  | "idle"        // waiting, soft breathe
  | "thinking"    // processing, blue/cyan spinning arc
  | "talking"     // streaming response, green ripples
  | "excited"     // upbeat content, fast yellow pulse
  | "empathetic"  // emotional/supportive content, purple glow (Luna especially)
  | "focused"     // technical/code content, white dash spin (Noe especially)
  | "barge-in";   // user interrupted, red flash

// ── Content keyword maps (AI response analysis) ──────────────────────────────

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
 */
export function detectContentMood(text: string, characterId: string): MoodType {
  const lower = text.toLowerCase();

  if (characterId === "luna") {
    if (EMPATHETIC_KEYWORDS.some((kw) => lower.includes(kw))) return "empathetic";
  }

  if (characterId === "noe") {
    if (FOCUSED_KEYWORDS.some((kw) => lower.includes(kw))) return "focused";
  }

  if (EXCITED_KEYWORDS.some((kw) => lower.includes(kw))) return "excited";
  if (EMPATHETIC_KEYWORDS.some((kw) => lower.includes(kw))) return "empathetic";
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
  return params.contentMood;
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


// ══════════════════════════════════════════════════════════════════════════════
// USER MOOD DETECTION — analyses the user's messages to sense their vibe
// ══════════════════════════════════════════════════════════════════════════════

export type UserMood =
  | "happy"       // upbeat, positive, celebrating
  | "stressed"    // overwhelmed, rushing, anxious
  | "sad"         // down, lonely, grieving
  | "curious"     // exploring, asking questions, learning
  | "frustrated"  // annoyed, things aren't working
  | "neutral"     // calm, matter-of-fact
  | "excited";    // hyped, enthusiastic, can't wait

// Keyword → mood scoring patterns (checked against user messages)
const USER_MOOD_SIGNALS: Record<UserMood, string[]> = {
  happy: [
    "haha", "lol", "😂", "😊", "🥰", "❤️", "love", "happy", "yay", "woohoo",
    "thank you", "thanks", "so good", "can't wait", "this is great", "perfect",
    "that's amazing", "brilliant", "nice one", "awesome", "🎉", "😄",
  ],
  stressed: [
    "stressed", "overwhelmed", "too much", "deadline", "rush", "hurry",
    "no time", "running out", "behind", "pressure", "panic", "ugh",
    "can't cope", "so busy", "exhausted", "burnt out", "burned out",
    "i need to", "asap", "urgent", "help me quickly",
  ],
  sad: [
    "sad", "lonely", "miss", "depressed", "down", "crying", "cry",
    "heartbroken", "lost someone", "grief", "hopeless", "empty",
    "don't know what to do", "feeling low", "😢", "😭", "💔",
    "nobody", "alone", "sucks", "hate my", "i can't",
  ],
  curious: [
    "how does", "what is", "why does", "tell me about", "explain",
    "i wonder", "curious", "interesting", "how do i", "what if",
    "could you show", "teach me", "learn", "explore", "discover",
    "what's the difference", "how come", "?",
  ],
  frustrated: [
    "doesn't work", "not working", "broken", "annoying", "frustrated",
    "angry", "stupid", "ridiculous", "terrible", "worst", "hate this",
    "why won't", "keeps failing", "impossible", "give up", "fed up",
    "sick of", "what the", "wtf", "seriously?", "come on",
  ],
  excited: [
    "omg", "oh my god", "so excited", "can't believe", "just got",
    "guess what", "big news", "finally", "!!!",  "let's do it",
    "pumped", "hyped", "🔥", "🚀", "amazing news", "i did it",
    "we did it", "incredible", "best day",
  ],
  neutral: [], // fallback — no keywords needed
};

/**
 * Analyse the last few user messages and detect their emotional state.
 * Scans up to the last 5 user messages for signal density.
 */
export function detectUserMood(
  messages: Array<{ role: string; text: string }>
): UserMood {
  // Grab last 5 user messages
  const userMsgs = messages
    .filter((m) => m.role === "user")
    .slice(-5)
    .map((m) => m.text.toLowerCase());

  if (userMsgs.length === 0) return "neutral";

  const combined = userMsgs.join(" ");

  // Score each mood
  const scores: Record<UserMood, number> = {
    happy: 0, stressed: 0, sad: 0, curious: 0,
    frustrated: 0, excited: 0, neutral: 0,
  };

  for (const [mood, keywords] of Object.entries(USER_MOOD_SIGNALS) as [UserMood, string[]][]) {
    for (const kw of keywords) {
      if (combined.includes(kw)) scores[mood]++;
    }
  }

  // Boost recent messages (last message counts more)
  const lastMsg = userMsgs[userMsgs.length - 1];
  for (const [mood, keywords] of Object.entries(USER_MOOD_SIGNALS) as [UserMood, string[]][]) {
    for (const kw of keywords) {
      if (lastMsg.includes(kw)) scores[mood] += 2; // triple weight for latest
    }
  }

  // Find highest-scoring mood
  let best: UserMood = "neutral";
  let bestScore = 0;
  for (const [mood, score] of Object.entries(scores) as [UserMood, number][]) {
    if (score > bestScore) {
      best = mood;
      bestScore = score;
    }
  }

  return bestScore >= 1 ? best : "neutral";
}

/**
 * Build an AI system prompt instruction based on the detected user mood.
 * The AI should adapt its tone, energy, and communication style.
 */
export function buildMoodInstruction(userMood: UserMood, messages?: Array<{ role: string; text: string }>): string {
  const instructions: Record<UserMood, string> = {
    happy: (
      "The user seems happy and upbeat right now. Match their positive energy! " +
      "Be enthusiastic, celebratory, and lighthearted. Use warm language and " +
      "feel free to share in their joy. Keep the good vibes flowing."
    ),
    stressed: (
      "The user seems stressed or overwhelmed. Be calm, clear, and supportive. " +
      "Keep responses concise and actionable — avoid adding more to their plate. " +
      "Offer structure and help them prioritise. Be a grounding presence."
    ),
    sad: (
      "The user seems sad or going through a difficult time. Be gentle, warm, and empathetic. " +
      "Acknowledge their feelings without rushing to fix things. Listen first, advise second. " +
      "Use soft, compassionate language. Let them know they're not alone."
    ),
    curious: (
      "The user is in an exploratory, curious mood. Lean into being informative and engaging. " +
      "Share interesting details, offer follow-up questions, and encourage their exploration. " +
      "Be a knowledgeable, enthusiastic guide."
    ),
    frustrated: (
      "The user seems frustrated or annoyed. Stay patient and solution-oriented. " +
      "Don't be overly cheerful — acknowledge the frustration first, then help fix it. " +
      "Be direct, practical, and avoid filler. Show you take their issue seriously."
    ),
    excited: (
      "The user is excited and hyped! Be enthusiastic and amplify their energy. " +
      "Celebrate with them, use energetic language, and build on their momentum. " +
      "This is a moment to be genuinely thrilled alongside them."
    ),
    neutral: (
      "The user's mood is neutral or unclear. Be friendly, balanced, and adaptable. " +
      "Match a conversational middle ground — neither too energetic nor too subdued."
    ),
  };

  // Detect user's communication style based on message length
  let lengthMirror = "";
  if (messages && messages.length > 0) {
    const userMsgs = messages.filter((m) => m.role === "user").slice(-5);
    if (userMsgs.length > 0) {
      const avgLen = userMsgs.reduce((sum, m) => sum + m.text.length, 0) / userMsgs.length;
      if (avgLen < 30) {
        lengthMirror = "\nIMPORTANT — MIRROR THE USER'S BREVITY: The user writes very short messages. " +
          "Match their style — keep your responses to 1-2 sentences max. Do NOT over-explain or add filler. " +
          "Be direct and efficient. A short answer to a short question.";
      } else if (avgLen < 80) {
        lengthMirror = "\nIMPORTANT — MIRROR THE USER'S STYLE: The user writes concise messages. " +
          "Keep your responses similarly focused — 2-4 sentences max unless the topic demands more. " +
          "Avoid long introductions, excessive compliments, or filler.";
      }
      // If avgLen >= 80, the user writes longer messages — no constraint needed
    }
  }

  return (
    "\n\n--- USER MOOD AWARENESS ---\n" +
    `Detected user mood: ${userMood.toUpperCase()}\n` +
    instructions[userMood] +
    lengthMirror +
    "\nAdapt your tone and style to this mood throughout your response. " +
    "If the mood shifts mid-conversation, follow the shift naturally.\n" +
    "--- END MOOD ---"
  );
}
