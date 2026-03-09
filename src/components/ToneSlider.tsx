import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Unlock } from "lucide-react";

/**
 * Empathic Tone Engine
 *
 * A dual-mode tone control that lives inside the chat input area.
 *
 * AUTO MODE (default):
 *   The orb reads the user's latest message for emotional cues and
 *   gently suggests a matching tone via colour shifts + tooltip.
 *   The system prompt is adjusted to mirror the detected mood.
 *
 * MANUAL MODE (user locks the slider):
 *   Auto-sensing pauses. The user's chosen slider position sets
 *   the tone directly. The orb still shows the active colour.
 *
 * Priority: user intent always overrides algorithmic suggestion.
 */

/* ─── Sentiment analysis (modular — swap with real API later) ─────────────── */

export type DetectedMood =
  | "neutral"
  | "excited"
  | "frustrated"
  | "sad"
  | "urgent"
  | "curious"
  | "playful";

interface SentimentResult {
  mood: DetectedMood;
  confidence: number; // 0–1
  suggestion: string; // Gentle tooltip text
  sliderTarget: number; // Where the slider should move (0–100)
}

const MOOD_KEYWORDS: Record<DetectedMood, string[]> = {
  excited: [
    "amazing", "love", "fantastic", "brilliant", "awesome", "incredible",
    "perfect", "great", "wonderful", "wow", "yes!", "let's go", "can't wait",
    "so good", "thrilled", "delighted", "happy", "celebrate",
  ],
  frustrated: [
    "not working", "broken", "doesn't work", "can't", "won't", "bug",
    "error", "wrong", "frustrated", "annoying", "stuck", "help me",
    "why is", "still not", "ugh", "again", "failing", "impossible",
  ],
  sad: [
    "sad", "upset", "down", "lonely", "miss", "lost", "cry", "depressed",
    "anxious", "worried", "scared", "overwhelmed", "exhausted", "tired",
    "struggling", "hard time", "difficult", "hurting",
  ],
  urgent: [
    "asap", "urgent", "now", "quickly", "deadline", "hurry", "rush",
    "immediately", "critical", "emergency", "time sensitive", "need this fast",
  ],
  curious: [
    "how does", "what if", "why", "could you explain", "wondering",
    "curious", "tell me more", "interesting", "how come", "what about",
  ],
  playful: [
    "haha", "lol", "funny", "joke", "silly", "goofy", "fun", "play",
    "game", "imagine", "dream", "wild", "crazy idea", "what if we",
  ],
  neutral: [],
};

const MOOD_CONFIG: Record<DetectedMood, { suggestion: string; sliderTarget: number }> = {
  neutral:    { suggestion: "",                                          sliderTarget: 50 },
  excited:    { suggestion: "Matching your energy ✨",                   sliderTarget: 80 },
  frustrated: { suggestion: "Switching to focused mode 🎯",             sliderTarget: 20 },
  sad:        { suggestion: "Taking it gently 💙",                       sliderTarget: 30 },
  urgent:     { suggestion: "Keeping it quick and focused ⚡",           sliderTarget: 10 },
  curious:    { suggestion: "Going in-depth for you 🔍",                sliderTarget: 60 },
  playful:    { suggestion: "Let's have some fun 🎭",                   sliderTarget: 90 },
};

/** Analyse a message for emotional cues. Modular — replace body with API call. */
export function analyseSentiment(text: string): SentimentResult {
  const lower = text.toLowerCase();
  let bestMood: DetectedMood = "neutral";
  let bestScore = 0;

  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS) as [DetectedMood, string[]][]) {
    if (mood === "neutral") continue;
    const hits = keywords.filter((kw) => lower.includes(kw)).length;
    const score = hits / keywords.length;
    if (score > bestScore) {
      bestScore = score;
      bestMood = mood;
    }
  }

  // Require at least one keyword match
  if (bestScore === 0) bestMood = "neutral";

  const config = MOOD_CONFIG[bestMood];
  return {
    mood: bestMood,
    confidence: Math.min(bestScore * 5, 1), // scale up for low keyword counts
    suggestion: config.suggestion,
    sliderTarget: config.sliderTarget,
  };
}

/* ─── Tone spectrum (visual) ──────────────────────────────────────────────── */
const TONE_LABELS = ["Focused", "Balanced", "Friendly", "Playful", "Whimsical"];

/** Hue: 170 teal → 320 pink/magenta (avoids dark blue at the focused end) */
const valueToHue = (v: number) => 170 + (v / 100) * 150;
const valueToSat = (v: number) => 65 + (v / 100) * 25;
/** Lightness: starts at 55% (readable teal) → 65% (bright pink) */
const valueToLight = (v: number) => 55 + (v / 100) * 10;

const toneColor = (v: number) =>
  `hsl(${valueToHue(v)}, ${valueToSat(v)}%, ${valueToLight(v)}%)`;

const toneGlow = (v: number) =>
  `0 0 12px ${toneColor(v)}, 0 0 24px ${toneColor(v)}40`;

const toneLabel = (v: number): string => {
  const idx = Math.round((v / 100) * (TONE_LABELS.length - 1));
  return TONE_LABELS[idx];
};

const toneEmoji = (v: number): string => {
  if (v < 15) return "🎯";  // Focused / urgent
  if (v < 30) return "🧊";  // Serious
  if (v < 50) return "🤔";  // Balanced
  if (v < 70) return "😊";  // Friendly
  if (v < 85) return "😄";  // Playful
  return "🎭";               // Whimsical
};

/* ─── Storage (session-scoped — lock resets each new conversation) ─────── */
const STORAGE_KEY = "ai-tone-slider";

interface ToneState {
  value: number;
  locked: boolean;         // Manual override active (per-session only)
  autoMood: DetectedMood;  // Last auto-detected mood
}

/** Map the customize tab's tone setting to a slider starting value */
const CUSTOMISE_TONE_TO_SLIDER: Record<string, number> = {
  direct: 10,
  professional: 20,
  warm: 50,
  friendly: 60,
  casual: 70,
};

const getInitialValue = (): number => {
  try {
    const settings = JSON.parse(localStorage.getItem("customize-settings") ?? "{}");
    const tone = settings.tone ?? "warm";
    return CUSTOMISE_TONE_TO_SLIDER[tone] ?? 50;
  } catch { return 50; }
};

const loadTone = (): ToneState => {
  try {
    // Session-scoped: use sessionStorage so lock resets per conversation
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { value: getInitialValue(), locked: false, autoMood: "neutral" };
};

const saveTone = (state: ToneState) => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

/* ─── Component ───────────────────────────────────────────────────────────── */

interface ToneSliderProps {
  /** Latest user message — feed this to enable auto-sensing */
  lastUserMessage?: string;
  /** Callback when tone changes */
  onChange?: (value: number) => void;
}

const ToneSlider = ({ lastUserMessage, onChange }: ToneSliderProps) => {
  const [expanded, setExpanded] = useState(false);
  const [tone, setTone] = useState<ToneState>(loadTone);
  const [suggestion, setSuggestion] = useState("");
  const [showSuggestion, setShowSuggestion] = useState(false);

  const { value, locked, autoMood } = tone;

  // Persist and notify on change
  useEffect(() => {
    saveTone(tone);
    onChange?.(tone.value);
  }, [tone]);

  // ── Auto-sense mood from user's latest message ───────────────────────────
  useEffect(() => {
    if (!lastUserMessage || locked) return; // Respect manual override

    const result = analyseSentiment(lastUserMessage);
    if (result.mood === "neutral" || result.confidence < 0.05) return;

    // Smoothly suggest the new tone
    setTone((prev) => ({
      ...prev,
      value: result.sliderTarget,
      autoMood: result.mood,
    }));

    // Show gentle suggestion tooltip
    setSuggestion(result.suggestion);
    setShowSuggestion(true);
    const timer = setTimeout(() => setShowSuggestion(false), 4000);
    return () => clearTimeout(timer);
  }, [lastUserMessage, locked]);

  const updateValue = useCallback((v: number) => {
    // Manual slider drag — update value but don't auto-lock
    setTone((prev) => ({ ...prev, value: v }));
  }, []);

  const toggleLock = useCallback(() => {
    setTone((prev) => {
      if (prev.locked) {
        // Unlocking → re-enable auto-sensing
        return { ...prev, locked: false };
      }
      // Locking → keep current position
      return { ...prev, locked: true };
    });
  }, []);

  const modeLabel = locked ? "Manual" : "Auto";
  const modeColor = locked ? "text-amber-400" : "text-emerald-400";

  return (
    <div className="relative flex items-center">
      {/* ── Glowing Orb ─── */}
      <motion.button
        onClick={() => setExpanded(!expanded)}
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative"
        style={{ background: toneColor(value) }}
        whileTap={{ scale: 0.9 }}
        animate={{
          boxShadow: expanded ? toneGlow(value) : `0 0 6px ${toneColor(value)}60`,
        }}
        transition={{ duration: 0.3 }}
        title={`Tone: ${toneLabel(value)} (${modeLabel}) — tap to adjust`}
      >
        <motion.span
          className="text-sm leading-none"
          key={toneEmoji(value)}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
        >
          {toneEmoji(value)}
        </motion.span>

        {/* Pulse ring — skip if reduced motion is on */}
        {!document.documentElement.classList.contains("reduce-motion") && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ border: `2px solid ${toneColor(value)}` }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </motion.button>

      {/* Always-visible mode label next to orb */}
      {!expanded && (
        <span className={`ml-1.5 text-[8px] font-bold tracking-wider uppercase ${modeColor}`}>
          {locked ? "Locked" : "Auto"}
        </span>
      )}

      {/* ── Expanded Slider Panel ─── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, width: 0, x: -8 }}
            animate={{ opacity: 1, width: "auto", x: 0 }}
            exit={{ opacity: 0, width: 0, x: -8 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="ml-2 flex items-center gap-2 overflow-hidden"
          >
            {/* Labels + Slider */}
            <div className="flex flex-col items-center gap-0.5 min-w-[160px]">
              {/* Current label + mode */}
              <div className="flex items-center gap-1.5">
                <motion.span
                  key={toneLabel(value)}
                  initial={{ y: -4, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="text-[9px] font-bold tracking-wide"
                  style={{ color: toneColor(value) }}
                >
                  {toneLabel(value)}
                </motion.span>
                <span className={`text-[7px] font-semibold ${modeColor}`}>
                  {modeLabel}
                </span>
              </div>

              {/* Slider track */}
              <div className="relative w-full h-6 flex items-center">
                <div
                  className="absolute inset-x-0 h-1.5 rounded-full"
                  style={{
                    background: `linear-gradient(to right, ${toneColor(0)}, ${toneColor(50)}, ${toneColor(100)})`,
                    opacity: 0.7,
                  }}
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={value}
                  onChange={(e) => updateValue(Number(e.target.value))}
                  className="tone-slider-input absolute inset-x-0 w-full h-6 appearance-none bg-transparent cursor-pointer"
                  style={{ "--tone-color": toneColor(value) } as React.CSSProperties}
                />
              </div>

              {/* Range labels */}
              <div className="flex justify-between w-full px-0.5">
                <span className="text-[7px] text-foreground/40 font-medium">Concise</span>
                <span className="text-[7px] text-foreground/40 font-medium">Chatty</span>
              </div>
            </div>

            {/* Lock / Unlock */}
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={toggleLock}
              className={`p-1.5 rounded-lg transition-colors ${
                locked
                  ? "bg-amber-400/40 text-amber-400"
                  : "bg-emerald-400/20 text-emerald-400/80 hover:text-emerald-400"
              }`}
              title={locked ? "Unlock — re-enable auto-sensing" : "Lock — keep this tone"}
            >
              {locked ? <Lock size={12} /> : <Unlock size={12} />}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ToneSlider;
