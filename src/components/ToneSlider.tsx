import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Unlock } from "lucide-react";
import type { UserMood } from "@/lib/moodDetector";

/**
 * Empathic Tone Engine
 *
 * A dual-mode tone control that lives inside the chat input area.
 *
 * AUTO MODE (default):
 *   Reads the `detectedMood` prop (from the unified moodDetector)
 *   and adjusts slider position, orb colour, and tooltip to match.
 *   The AI system prompt receives the same mood, so visuals and
 *   AI behaviour are always in sync.
 *
 * MANUAL MODE (user locks the slider):
 *   Auto-sensing pauses. The user's chosen slider position sets
 *   the tone directly.
 *
 * Priority: user intent always overrides algorithmic suggestion.
 */

/* ─── UserMood → visual config mapping ────────────────────────────────────── */

interface MoodVisual {
  sliderTarget: number;
  suggestion: string;
  emoji: string;
}

const MOOD_VISUALS: Record<UserMood, MoodVisual> = {
  happy:      { sliderTarget: 70, suggestion: "Matching your good vibes ✨",     emoji: "😊" },
  stressed:   { sliderTarget: 20, suggestion: "Keeping it calm & clear 🧘",       emoji: "😰" },
  sad:        { sliderTarget: 30, suggestion: "Taking it gently 💙",              emoji: "🫂" },
  curious:    { sliderTarget: 60, suggestion: "Going in-depth for you 🔍",        emoji: "🤔" },
  frustrated: { sliderTarget: 15, suggestion: "Focused & solution-ready 🎯",      emoji: "😤" },
  excited:    { sliderTarget: 85, suggestion: "Let's gooo! 🔥",                   emoji: "🤩" },
  neutral:    { sliderTarget: 50, suggestion: "",                                  emoji: "😌" },
};

/* ─── Tone spectrum (visual) ──────────────────────────────────────────────── */
const TONE_LABELS = ["Focused", "Balanced", "Friendly", "Playful", "Whimsical"];

/** Hue: 170 teal → 320 pink/magenta */
const valueToHue = (v: number) => 170 + (v / 100) * 150;
const valueToSat = (v: number) => 65 + (v / 100) * 25;
const valueToLight = (v: number) => 55 + (v / 100) * 10;

const toneColor = (v: number) =>
  `hsl(${valueToHue(v)}, ${valueToSat(v)}%, ${valueToLight(v)}%)`;

const toneGlow = (v: number) =>
  `0 0 12px ${toneColor(v)}, 0 0 24px ${toneColor(v)}40`;

const toneLabel = (v: number): string => {
  const idx = Math.round((v / 100) * (TONE_LABELS.length - 1));
  return TONE_LABELS[idx];
};

const toneEmoji = (v: number, moodEmoji?: string): string => {
  if (moodEmoji) return moodEmoji;
  if (v < 15) return "🎯";
  if (v < 30) return "🧊";
  if (v < 50) return "🤔";
  if (v < 70) return "😊";
  if (v < 85) return "😄";
  return "🎭";
};

/* ─── Storage (session-scoped) ────────────────────────────────────────────── */
const STORAGE_KEY = "ai-tone-slider";

interface ToneState {
  value: number;
  locked: boolean;
  autoMood: UserMood;
}

/** Map the customize tab's tone setting to a slider starting value */
const CUSTOMISE_TONE_TO_SLIDER: Record<string, number> = {
  direct: 10, professional: 20, warm: 50, friendly: 60, casual: 70,
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
  /** Detected user mood from the unified moodDetector */
  detectedMood?: UserMood;
  /** Callback when tone changes */
  onChange?: (value: number) => void;
}

const ToneSlider = ({ detectedMood = "neutral", onChange }: ToneSliderProps) => {
  const [expanded, setExpanded] = useState(false);
  const [tone, setTone] = useState<ToneState>(loadTone);
  const [suggestion, setSuggestion] = useState("");
  const [showSuggestion, setShowSuggestion] = useState(false);

  const { value, locked, autoMood } = tone;
  const visual = MOOD_VISUALS[autoMood] || MOOD_VISUALS.neutral;

  // Persist and notify on change
  useEffect(() => {
    saveTone(tone);
    onChange?.(tone.value);
  }, [tone]);

  // ── Auto-sense: react to unified detectedMood prop ───────────────────────
  useEffect(() => {
    if (locked) return; // Respect manual override
    if (detectedMood === "neutral" || detectedMood === autoMood) return;

    const moodVisual = MOOD_VISUALS[detectedMood];

    // Update slider position and mood state
    setTone((prev) => ({
      ...prev,
      value: moodVisual.sliderTarget,
      autoMood: detectedMood,
    }));

    // Show suggestion tooltip
    if (moodVisual.suggestion) {
      setSuggestion(moodVisual.suggestion);
      setShowSuggestion(true);
      const timer = setTimeout(() => setShowSuggestion(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [detectedMood, locked]);

  const updateValue = useCallback((v: number) => {
    setTone((prev) => ({ ...prev, value: v }));
  }, []);

  const toggleLock = useCallback(() => {
    setTone((prev) => ({
      ...prev,
      locked: !prev.locked,
    }));
  }, []);

  const modeLabel = locked ? "Manual" : "Auto";
  const modeColor = locked ? "text-amber-400" : "text-emerald-400";
  const currentEmoji = toneEmoji(value, locked ? undefined : visual.emoji);

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
        title={`Tone: ${toneLabel(value)} (${modeLabel}) — Mood: ${autoMood}`}
      >
        <motion.span
          className="text-sm leading-none"
          key={currentEmoji}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
        >
          {currentEmoji}
        </motion.span>

        {/* Pulse ring */}
        {!document.documentElement.classList.contains("reduce-motion") && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ border: `2px solid ${toneColor(value)}` }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </motion.button>

      {/* Always-visible mood + mode label */}
      {!expanded && (
        <div className="ml-1.5 flex flex-col items-start">
          <span className={`text-[8px] font-bold tracking-wider uppercase ${modeColor}`}>
            {locked ? "Locked" : "Auto"}
          </span>
          {!locked && autoMood !== "neutral" && (
            <span className="text-[7px] text-foreground/40 capitalize">{autoMood}</span>
          )}
        </div>
      )}

      {/* Suggestion toast */}
      <AnimatePresence>
        {showSuggestion && suggestion && !expanded && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            className="absolute left-12 top-0 glass rounded-lg px-2 py-1 text-[9px] text-foreground/70 whitespace-nowrap"
          >
            {suggestion}
          </motion.div>
        )}
      </AnimatePresence>

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
                {!locked && autoMood !== "neutral" && (
                  <span className="text-[7px] text-foreground/40 capitalize">
                    ({autoMood})
                  </span>
                )}
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

