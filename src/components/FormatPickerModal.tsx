import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { FORMAT_OPTIONS, type CanvasFormat } from "@/lib/canvasStore";

interface FormatPickerModalProps {
  show: boolean;
  onSelect: (format: CanvasFormat) => void;
  onClose: () => void;
}

/**
 * Bottom-sheet modal for selecting the Canvas format.
 * Slides up over the current page with a backdrop.
 */
const FormatPickerModal = ({ show, onSelect, onClose }: FormatPickerModalProps) => {
  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/55 backdrop-blur-sm z-40"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 glass rounded-t-3xl px-6 pt-6 pb-12"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Choose a format</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  How should this session be saved?
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl glass"
                aria-label="Close"
              >
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            {/* Format grid */}
            <div className="grid grid-cols-2 gap-3">
              {FORMAT_OPTIONS.map((fmt) => (
                <motion.button
                  key={fmt.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSelect(fmt.id)}
                  className="flex flex-col items-start gap-2 p-4 rounded-2xl glass border border-border/40 text-left transition-colors active:border-primary/50"
                >
                  <span className="text-2xl">{fmt.icon}</span>
                  <span className="text-sm font-semibold text-foreground">{fmt.label}</span>
                  <span className="text-xs text-muted-foreground leading-snug">
                    {fmt.description}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FormatPickerModal;
