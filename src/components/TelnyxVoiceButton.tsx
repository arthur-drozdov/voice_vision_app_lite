/**
 * TelnyxVoiceButton
 *
 * Connects browser directly to the Telnyx AI Assistant via WebRTC.
 * The assistant handles STT → LLM → TTS with a custom cloned voice + all tools.
 *
 * No Lambda, no VAD model — just browser WebRTC → Telnyx carrier network.
 */

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Phone, PhoneOff, Loader2, PhoneCall } from "lucide-react";
import { useTelnyxVoice, type TelnyxCallState } from "@/hooks/useTelnyxVoice";

export interface TelnyxVoiceButtonProps {
  assistantId?: string;
  className?: string;
  iconSize?: number;
}

const stateConfig: Record<
  TelnyxCallState,
  { label: string; bg: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  idle: { label: "Voice off", bg: "bg-muted hover:bg-muted/80", icon: Phone },
  connecting: { label: "Connecting…", bg: "bg-amber-500/20", icon: Loader2 },
  ready: { label: "Ready", bg: "bg-blue-500 hover:bg-blue-600", icon: Phone },
  calling: { label: "Calling…", bg: "bg-blue-500", icon: PhoneCall },
  active: { label: "In call", bg: "bg-emerald-500", icon: PhoneOff },
  ended: { label: "Ended", bg: "bg-muted", icon: Phone },
  error: { label: "Error", bg: "bg-red-500", icon: PhoneOff },
};

export function TelnyxVoiceButton({
  assistantId,
  className,
  iconSize = 18,
}: TelnyxVoiceButtonProps) {
  const { state, error, start, stop, toggle } = useTelnyxVoice({ assistantId });

  const config = stateConfig[state];
  const Icon = config.icon;
  const isActive = state === "active" || state === "calling" || state === "connecting";
  const isTransitioning = state === "connecting" || state === "calling";

  // Show error briefly
  useEffect(() => {
    if (error) console.warn("[TelnyxButton] Error:", error);
  }, [error]);

  return (
    <div className="relative inline-flex flex-col items-center gap-1.5">
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={toggle}
        title={error || config.label}
        className={[
          "relative w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-all duration-300",
          config.bg,
          isActive ? "text-white shadow-lg shadow-current/25" : "text-foreground/60",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Pulse ring when in call */}
        {state === "active" && (
          <motion.span
            className="absolute inset-0 rounded-full bg-emerald-500"
            animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}

        {/* Spinner when connecting */}
        {isTransitioning && (
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-white/30 border-t-white/80"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        )}

        <Icon
          size={iconSize}
          className={isTransitioning ? "animate-none" : ""}
        />
      </motion.button>

      {/* Label */}
      <AnimatedLabel label={config.label} active={isActive} error={!!error} />
    </div>
  );
}

/**
 * Compact inline variant — just the button, no label.
 * For use in control bars and toolbars.
 */
export function TelnyxVoiceButtonCompact({
  assistantId,
  className,
  iconSize = 16,
}: TelnyxVoiceButtonProps) {
  const { state, toggle } = useTelnyxVoice({ assistantId });
  const config = stateConfig[state];
  const Icon = config.icon;
  const isActive = state === "active" || state === "calling" || state === "connecting";
  const isTransitioning = state === "connecting" || state === "calling";

  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={toggle}
      title={config.label}
      className={[
        "relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-300",
        isActive
          ? "bg-purple-600/60 text-purple-300 shadow-lg shadow-purple-500/25"
          : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {state === "active" && (
        <motion.span
          className="absolute inset-0 rounded-full bg-purple-500/40"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
      {isTransitioning && (
        <Loader2 size={iconSize} className="animate-spin text-purple-300" />
      )}
      {!isTransitioning && <Icon size={iconSize} />}
    </motion.button>
  );
}

/** Sliding label transition */
function AnimatedLabel({
  label,
  active,
  error,
}: {
  label: string;
  active: boolean;
  error: boolean;
}) {
  return (
    <motion.span
      key={label}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className={`text-[11px] font-medium text-center whitespace-nowrap ${
        error ? "text-red-400" : active ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      {label}
    </motion.span>
  );
}
