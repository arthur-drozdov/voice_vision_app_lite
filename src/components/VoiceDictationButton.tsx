import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff } from "lucide-react";

interface VoiceDictationButtonProps {
  onResult: (text: string) => void;
  /** Called with partial/interim text while still speaking (for live preview) */
  onInterim?: (text: string) => void;
  disabled?: boolean;
  /** CSS classes for the button (overrides default sizing/styling) */
  className?: string;
  /** Icon size in px (default 16) */
  iconSize?: number;
}

// Extend window type for cross-browser SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}

/**
 * Tap-to-record voice dictation button using Web Speech API.
 * Calls onInterim(text) with live partial transcript, then onResult(text) on completion.
 */
const VoiceDictationButton = ({
  onResult,
  onInterim,
  disabled = false,
  className,
  iconSize = 16,
}: VoiceDictationButtonProps) => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalizedRef = useRef(""); // accumulates finalized segments

  const SpeechRecognitionAPI =
    window.SpeechRecognition ?? window.webkitSpeechRecognition;

  const isSupported = !!SpeechRecognitionAPI;

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

  const toggle = () => {
    if (isListening) stopListening();
    else startListening();
  };

  if (!isSupported) return null;

  const defaultClass =
    "w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors";
  const btnClass = className ?? defaultClass;

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={toggle}
        disabled={disabled}
        title={isListening ? "Tap to stop" : "Tap to dictate"}
        className={`${btnClass} ${
          isListening
            ? "bg-red-500"
            : disabled
            ? "bg-secondary/30 cursor-not-allowed"
            : "btn-send"
        }`}
      >
        {/* Ripple animation while listening */}
        <AnimatePresence>
          {isListening && (
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

        {isListening ? (
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
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 w-48 text-center text-[11px] text-destructive glass rounded-lg px-2 py-1.5 z-20"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoiceDictationButton;
