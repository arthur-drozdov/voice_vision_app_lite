/**
 * MoodRing
 *
 * Wraps a character avatar with an animated ring that reflects the AI's
 * current mood/state. The ring changes colour and animation style per mood.
 *
 * Usage:
 *   <MoodRing mood={mood} charColor={char.color} size="sm">
 *     <span className="text-2xl">{char.emoji}</span>
 *   </MoodRing>
 */

import { motion, AnimatePresence } from "framer-motion";
import { MoodType } from "@/lib/moodDetector";

interface MoodRingProps {
  mood: MoodType;
  charColor: string;       // character's theme colour (used for idle glow)
  size?: "sm" | "lg";      // sm = header (40px), lg = video avatar (192px)
  children: React.ReactNode;
  className?: string;
}

// ── Colour palette per mood ───────────────────────────────────────────────────
const MOOD_COLOURS: Record<MoodType, string> = {
  idle:       "",                          // uses charColor
  thinking:   "hsl(185, 88%, 55%)",        // cyan
  talking:    "hsl(145, 70%, 50%)",        // green
  excited:    "hsl(45, 90%, 58%)",         // yellow/orange
  empathetic: "hsl(270, 55%, 68%)",        // purple
  focused:    "hsl(0, 0%, 90%)",           // white
  "barge-in": "hsl(0, 70%, 55%)",          // red
};

const MoodRing = ({ mood, charColor, size = "sm", children, className = "" }: MoodRingProps) => {
  const ringThickness = size === "lg" ? 4 : 3;
  const glowSpread   = size === "lg" ? 24 : 10;

  return (
    <div
      className={`relative inline-flex items-center justify-center overflow-visible ${className}`}
      style={{ isolation: "isolate" }}
    >
      {/* ── TALKING — two expanding ripple rings ─────────────────────────── */}
      <AnimatePresence>
        {mood === "talking" && (
          <>
            {[0, 0.65].map((delay, i) => (
              <motion.div
                key={`ripple-${i}`}
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ border: `${ringThickness}px solid ${MOOD_COLOURS.talking}` }}
                initial={{ scale: 1, opacity: 0.7 }}
                animate={{ scale: size === "lg" ? 1.6 : 1.5, opacity: 0 }}
                transition={{ duration: 1.6, repeat: Infinity, delay, ease: "easeOut" }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* ── THINKING — rotating cyan conic-gradient arc ───────────────────── */}
      <AnimatePresence>
        {mood === "thinking" && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: `conic-gradient(from 0deg, transparent 65%, ${MOOD_COLOURS.thinking} 100%)`,
              WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${ringThickness + 1}px), black calc(100% - ${ringThickness + 1}px))`,
              mask: `radial-gradient(farthest-side, transparent calc(100% - ${ringThickness + 1}px), black calc(100% - ${ringThickness + 1}px))`,
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
          />
        )}
      </AnimatePresence>

      {/* ── FOCUSED — white spinning dashed ring ─────────────────────────── */}
      <AnimatePresence>
        {mood === "focused" && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              border: `${ringThickness}px dashed ${MOOD_COLOURS.focused}`,
              filter: `drop-shadow(0 0 ${size === "lg" ? 8 : 4}px ${MOOD_COLOURS.focused})`,
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          />
        )}
      </AnimatePresence>

      {/* ── BARGE-IN — red flashing ring ─────────────────────────────────── */}
      <AnimatePresence>
        {mood === "barge-in" && (
          <motion.div
            key="barge"
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              border: `${ringThickness + 1}px solid ${MOOD_COLOURS["barge-in"]}`,
              boxShadow: `0 0 ${glowSpread}px ${MOOD_COLOURS["barge-in"]}80`,
            }}
            animate={{ opacity: [1, 0.15, 1, 0.15] }}
            transition={{ duration: 0.3, repeat: Infinity }}
          />
        )}
      </AnimatePresence>

      {/* ── IDLE / EXCITED / EMPATHETIC — glow-based pulse ───────────────── */}
      <AnimatePresence>
        {(mood === "idle" || mood === "excited" || mood === "empathetic") && (
          <motion.div
            key={mood}
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              border: `${ringThickness}px solid ${
                mood === "idle" ? charColor + "80"
                : mood === "excited" ? MOOD_COLOURS.excited
                : MOOD_COLOURS.empathetic
              }`,
              boxShadow: (() => {
                if (mood === "idle")
                  return `0 0 ${glowSpread / 2}px ${charColor}30, 0 0 ${glowSpread}px ${charColor}15`;
                if (mood === "excited")
                  return `0 0 ${glowSpread}px ${MOOD_COLOURS.excited}60, 0 0 ${glowSpread * 2}px ${MOOD_COLOURS.excited}30`;
                return `0 0 ${glowSpread}px ${MOOD_COLOURS.empathetic}50, 0 0 ${glowSpread * 2}px ${MOOD_COLOURS.empathetic}25`;
              })(),
            }}
            initial={{ opacity: 0 }}
            animate={
              mood === "idle"
                ? { opacity: [0.4, 1, 0.4], scale: [1, 1.025, 1] }
                : mood === "excited"
                ? { opacity: [0.75, 1, 0.75], scale: [1, 1.06, 1] }
                : { opacity: [0.5, 1, 0.5] }
            }
            transition={
              mood === "idle"
                ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
                : mood === "excited"
                ? { duration: 0.45, repeat: Infinity, ease: "easeInOut" }
                : { duration: 2.5, repeat: Infinity, ease: "easeInOut" }
            }
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
          />
        )}
      </AnimatePresence>

      {/* ── Children ─────────────────────────────────────────────────────── */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default MoodRing;
