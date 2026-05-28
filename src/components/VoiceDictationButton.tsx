import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Waves } from "lucide-react";

interface VoiceDictationButtonProps {
  onResult: (text: string) => void;
  /** Called with partial/interim text while still speaking (for live preview) */
  onInterim?: (text: string) => void;
  disabled?: boolean;
  /** CSS classes for the button (overrides default sizing/styling) */
  className?: string;
  /** Icon size in px (default 16) */
  iconSize?: number;
  /** Input mode: "push-to-talk" (Web Speech API) or "vad" (client-side Silero VAD) */
  mode?: "push-to-talk" | "vad";
  /** VAD-specific props (only used when mode="vad") */
  vadProps?: {
    isSpeaking?: boolean;
    isListening?: boolean;
    isInitialized?: boolean;
    error?: string | null;
    onToggle?: () => void;
  };
}

// Extend window type for cross-browser SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}

/**
 * Tap-to-record voice dictation button.
 *
 * Two modes:
 * - "push-to-talk" (default): Uses Web Speech API for speech-to-text.
 *   Tap to start dictation, tap again to stop and finalise.
 * - "vad": Uses client-side VAD (@ricky0123/vad-web) for automatic speech detection.
 *   Visual indicator shows when VAD is listening and when speech is active.
 */
const VoiceDictationButton = ({
  onResult,
  onInterim,
  disabled = false,
  className,
  iconSize = 16,
  mode = "push-to-talk",
  vadProps,
}: VoiceDictationButtonProps) => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalizedRef = useRef(""); // accumulates finalized segments

  const SpeechRecognitionAPI =
    window.SpeechRecognition ?? window.webkitSpeechRecognition;

  const isSupported = mode === "push-to-talk"
    ? !!SpeechRecognitionAPI
    : true; // VAD support checked by the hook

  // ── Push-to-talk: Web Speech API ──────────────────────────────────────
  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      setError("Voice dictation is not supported in this browser.");
      return;
    }
    setError(null);
    finalizedRef.current = "";

    const rec = new SpeechRecognitionAPI();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event) => {
      let finalized = "";
      let interim = "";

      for (let i = 0; i < event.results.length; i++) {
        const text = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) {
          finalized += text;
        } else {
          interim += text;
        }
      }

      finalizedRef.current = finalized;
      const combined = (finalized + interim).trim();

      // Send live preview
      if (onInterim && combined) {
        onInterim(combined);
      }
    };

    rec.onerror = (event) => {
      console.error("[VoiceDictation] Error:", event.error);
      if (event.error === "no-speech") return;
      setError(
        event.error === "not-allowed"
          ? "Microphone access denied."
          : "Could not hear anything."
      );
      setIsListening(false);
    };

    rec.onend = () => {
      // Deliver final result
      const final = finalizedRef.current.trim();
      if (final) onResult(final);
      finalizedRef.current = "";
      setIsListening(false);
    };

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  }, [SpeechRecognitionAPI, onResult, onInterim]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  // ── VAD mode: delegate to parent ──────────────────────────────────────
  const isVadListening = vadProps?.isListening ?? false;
  const isVadSpeaking = vadProps?.isSpeaking ?? false;
  const vadError = vadProps?.error ?? null;

  const toggle = () => {
    if (mode === "vad") {
      vadProps?.onToggle?.();
    } else {
      if (isListening) stopListening();
      else startListening();
    }
  };

  if (!isSupported && mode === "push-to-talk") return null;

  const defaultClass =
    "w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors";
  const btnClass = className ?? defaultClass;

  // Determine visual state
  const active = mode === "vad" ? (isVadListening || isVadSpeaking) : isListening;
  const idle = mode === "vad" ? (!isVadListening && !vadError) : (!isListening && !error);

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={toggle}
        disabled={disabled || (mode === "vad" && !vadProps?.isInitialized)}
        title={
          mode === "vad"
            ? isVadSpeaking
              ? "Speaking…"
              : isVadListening
              ? "VAD active — tap to stop"
              : "Tap to start VAD"
            : isListening
            ? "Tap to stop"
            : "Tap to dictate"
        }
        className={`${btnClass} ${
          !idle
            ? mode === "vad" && isVadSpeaking
              ? "bg-emerald-500"
              : "bg-red-500"
            : disabled
            ? "bg-secondary/30 cursor-not-allowed"
            : "btn-send"
        }`}
      >
        {/* Ripple animation while active */}
        <AnimatePresence>
          {active && (
            <>
              <motion.span
                key="r1"
                className="absolute inset-0 rounded-full bg-red-500"
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 2.2, opacity: 0 }}
                exit={{}}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
              />
              <motion.span
                key="r2"
                className="absolute inset-0 rounded-full bg-red-500"
                initial={{ scale: 1, opacity: 0.4 }}
                animate={{ scale: 1.8, opacity: 0 }}
                exit={{}}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeOut",
                  delay: 0.3,
                }}
              />
            </>
          )}
        </AnimatePresence>

        {mode === "vad" && isVadSpeaking ? (
          <Waves size={iconSize} className="text-white relative z-10" />
        ) : active ? (
          <MicOff size={iconSize} className="text-white relative z-10" />
        ) : (
          <Mic
            size={iconSize}
            className="text-primary-foreground relative z-10"
          />
        )}
      </motion.button>

      {/* Error tooltip */}
      <AnimatePresence>
        {(error || vadError) && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 w-48 text-center text-[11px] text-destructive glass rounded-lg px-2 py-1.5 z-20"
          >
            {error || vadError}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoiceDictationButton;
