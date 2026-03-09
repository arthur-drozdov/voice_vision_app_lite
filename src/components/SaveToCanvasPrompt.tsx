import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { getBoards } from "@/lib/canvasStore";
import { getBoardLimit, getTier, TIER_CONFIGS } from "@/lib/subscriptionStore";

interface SaveToCanvasPromptProps {
  show: boolean;
  onSave: () => void;
  onDismiss: () => void;
  onKeepChatting?: () => void;
}

/**
 * Soft, non-intrusive bottom prompt after a session ends.
 * "Would you like to save this conversation to Canvas?"
 * Shows current board usage + tier info below the message.
 * Three actions: "Save to Canvas", "Keep Chatting", and "Maybe Later".
 */
const SaveToCanvasPrompt = ({ show, onSave, onDismiss, onKeepChatting }: SaveToCanvasPromptProps) => {
  // Compute board usage info fresh each render (accurate when prompt appears)
  const boardCount = getBoards().length;
  const boardLimit = getBoardLimit();
  const tier = getTier();
  const tierLabel = TIER_CONFIGS[tier].label;

  let usageHint: string | null = null;
  if (boardLimit === -1) {
    if (boardCount > 0) {
      usageHint = `${boardCount} board${boardCount !== 1 ? "s" : ""} saved \u00B7 ${tierLabel} plan`;
    }
  } else {
    const remaining = boardLimit - boardCount;
    if (remaining <= 0) {
      usageHint = `All ${boardLimit} board${boardLimit !== 1 ? "s" : ""} used \u00B7 ${tierLabel} \u2014 delete one to free up space or upgrade`;
    } else {
      usageHint = `${boardCount}/${boardLimit} boards used \u00B7 ${tierLabel} plan`;
    }
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="mx-5 mb-2 px-4 py-3 rounded-2xl glass border border-primary/20"
        >
          {/* Top row: icon + message + usage hint */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles size={14} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground leading-snug">
                Would you like to save this conversation to{" "}
                <span className="font-semibold text-primary">Canvas</span>?
              </p>
              {usageHint && (
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  {usageHint}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pl-10">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onSave}
              className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold glow-primary"
            >
              Save to Canvas
            </motion.button>
            {onKeepChatting && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onKeepChatting}
                className="flex-1 py-2 rounded-xl glass text-xs font-semibold text-green-400 border border-green-500/20"
              >
                Keep Chatting
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onDismiss}
              className="flex-1 py-2 rounded-xl glass text-muted-foreground text-xs font-medium"
            >
              Maybe Later
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SaveToCanvasPrompt;
