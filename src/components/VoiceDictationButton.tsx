import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff } from "lucide-react";

interface VoiceDictationButtonProps {
  onResult: (text: string) => void;
  disabled?: boolean;
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
 * Calls onResult(text) with the transcript on completion.
 */
const VoiceDictationButton = ({ onResult, disabled = false }: VoiceDictationButtonProps) => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const SpeechRecognitionAPI =
    window.SpeechRecognition ?? window.webkitSpeechRecognition;

  const isSupported = !!SpeechRecognitionAPI;

  const startListening = () => {
    if (!SpeechRecognitionAPI) {
      setError("Voice dictation is not supported in this browser.");
      return;
    }
    setError(null);

    const rec = new SpeechRecognitionAPI();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) onResult(transcript);
      setIsListening(false);
    };

    rec.onerror = (event) => {
      console.error("[VoiceDictation] Error:", event.error);
      setError(event.error === "not-allowed" ? "Microphone access denied." : "Could not hear anything.");
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const toggle = () => {
    if (isListening) stopListening();
    else startListening();
  };

  if (!isSupported) return null;

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={toggle}
        disabled={disabled}
        title={isListening ? "Tap to stop" : "Tap to dictate"}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          isListening
            ? "bg-red-500"
            : disabled
            ? "glass opacity-40 cursor-not-allowed"
            : "glass hover:border-primary/40"
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
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
              />
              <motion.span
                key="r2"
                className="absolute inset-0 rounded-full bg-red-500"
                initial={{ scale: 1, opacity: 0.4 }}
                animate={{ scale: 1.8, opacity: 0 }}
                exit={{}}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
              />
            </>
          )}
        </AnimatePresence>

        {isListening ? (
          <MicOff size={16} className="text-white relative z-10" />
        ) : (
          <Mic size={16} className="text-muted-foreground relative z-10" />
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
