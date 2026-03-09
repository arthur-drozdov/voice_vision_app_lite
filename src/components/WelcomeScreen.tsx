import { useState } from "react";
import { motion } from "framer-motion";
import { saveUserProfile } from "@/lib/userProfileStore";

interface WelcomeScreenProps {
  onComplete: (name: string) => void;
}

const WelcomeScreen = ({ onComplete }: WelcomeScreenProps) => {
  const [name, setName] = useState("");

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    saveUserProfile({ name: trimmed, setupComplete: true });
    onComplete(trimmed);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/95 backdrop-blur-lg"
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", damping: 24, stiffness: 260, delay: 0.1 }}
        className="w-full max-w-sm"
      >
        <div className="glass rounded-3xl p-8 border border-white/10 text-center space-y-6">
          {/* Animated emoji */}
          <motion.div
            animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="text-5xl"
          >
            ✨
          </motion.div>

          {/* Title */}
          <div>
            <h1 className="text-xl font-bold text-foreground">Welcome!</h1>
            <p className="text-sm text-foreground/60 mt-2 leading-relaxed">
              What should we call you? Your AI assistants will use your name to make conversations feel more personal.
            </p>
          </div>

          {/* Name input */}
          <div className="space-y-3">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Your name..."
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-base text-foreground placeholder:text-foreground/30 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all text-center"
            />
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSubmit}
              disabled={!name.trim()}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition-opacity disabled:opacity-30"
            >
              Let's go! 🚀
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default WelcomeScreen;
