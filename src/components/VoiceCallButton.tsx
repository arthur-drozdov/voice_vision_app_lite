/**
 * VoiceCallButton
 *
 * One-tap voice mode toggle. Shows VAD state visually:
 *   idle → tap to start → listening → speaking (user) → thinking → responding → idle
 *
 * Integrates useVoicePipeline for the full client-side VAD + Lambda pipeline.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Phone, PhoneOff, Loader2, Waves, Brain } from "lucide-react";
import { useVoicePipeline, type VoiceCallState, type VoiceCallMessage } from "@/hooks/useVoicePipeline";

export interface VoiceCallButtonProps {
  /** Lambda Function URL (default: VITE_VOICE_PIPELINE_URL env var) */
  pipelineUrl?: string;
  /** Called when a complete turn (user→assistant) finishes */
  onTurnComplete?: (userMsg: VoiceCallMessage, assistantMsg: VoiceCallMessage) => void;
  /** CSS classes for the button */
  className?: string;
  /** Icon size */
  iconSize?: number;
  /** Auto-start VAD when component mounts */
  autoStart?: boolean;
}

const stateConfig: Record<VoiceCallState, {
  label: string;
  bg: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = {
  idle:       { label: "Voice off",       bg: "bg-muted hover:bg-muted/80",          icon: Mic },
  initializing: { label: "Loading VAD…",  bg: "bg-amber-500/20",                      icon: Loader2 },
  listening:  { label: "Listening…",      bg: "bg-blue-500 hover:bg-blue-600",        icon: Mic },
  speaking:   { label: "Speaking…",       bg: "bg-emerald-500",                       icon: Waves },
  thinking:   { label: "Thinking…",       bg: "bg-violet-500",                        icon: Brain },
  responding: { label: "Responding…",     bg: "bg-fuchsia-500",                       icon: Phone },
};

export function VoiceCallButton({
  pipelineUrl,
  onTurnComplete,
  className,
  iconSize = 18,
  autoStart = false,
}: VoiceCallButtonProps) {
  const pipeline = useVoicePipeline({
    pipelineUrl,
    onMessage: (user, assistant) => onTurnComplete?.(user, assistant),
    autoStart,
  });

  const { state, isInitialized, error, start, stop, toggle, turnCount } = pipeline;
  const config = stateConfig[state];
  const Icon = config.icon;
  const isActive = state !== "idle" && state !== "initializing";
  const isInitializing = state === "initializing";

  return (
    <div className="relative inline-flex flex-col items-center gap-1.5">
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={toggle}
        disabled={!isInitialized && state !== "initializing"}
        title={
          error
            ? `Error: ${error}`
            : isInitializing
            ? "Loading voice detection model…"
            : isActive
            ? "Tap to stop"
            : "Tap to start voice mode"
        }
        className={[
          "relative w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-all duration-300",
          config.bg,
          !isActive && !isInitializing ? "text-foreground/60" : "text-white",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Pulse ring while active */}
        <AnimatePresence>
          {isActive && (
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-current"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 1.6, opacity: 0 }}
              exit={{}}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>

        {isInitializing ? (
          <Loader2 size={iconSize} className="animate-spin" />
        ) : (
          <Icon size={iconSize} className="relative z-10" />
        )}
      </motion.button>

      {/* Label */}
      <span className="text-[10px] text-muted-foreground text-center leading-tight">
        {error ? error.slice(0, 40) : config.label}
      </span>

      {/* Turn counter (subtle) */}
      {turnCount > 0 && (
        <span className="text-[9px] text-muted-foreground/50 tabular-nums">
          {turnCount} turn{turnCount !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

/**
 * Compact inline variant — just the button, no label.
 * Good for chat input bars.
 */
export function VoiceCallButtonCompact(props: VoiceCallButtonProps) {
  const pipeline = useVoicePipeline({
    pipelineUrl: props.pipelineUrl,
    onMessage: props.onTurnComplete,
    autoStart: props.autoStart,
  });

  const { state, isInitialized, error, toggle } = pipeline;
  const config = stateConfig[state];
  const Icon = config.icon;
  const isActive = state !== "idle" && state !== "initializing";
  const isInitializing = state === "initializing";

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={toggle}
      disabled={!isInitialized && state !== "initializing"}
      title={error || config.label}
      className={[
        "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-300",
        isActive ? config.bg + " text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted",
        props.className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <AnimatePresence>
        {isActive && (
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-current/40"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.5, opacity: 0 }}
            exit={{}}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {isInitializing ? (
        <Loader2 size={props.iconSize || 16} className="animate-spin" />
      ) : (
        <Icon size={props.iconSize || 16} className="relative z-10" />
      )}
    </motion.button>
  );
}

export default VoiceCallButton;
