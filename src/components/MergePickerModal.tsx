import { motion, AnimatePresence } from "framer-motion";
import { X, Plus } from "lucide-react";
import { FORMAT_OPTIONS, type CanvasBoard } from "@/lib/canvasStore";

interface MergePickerModalProps {
  show: boolean;
  boards: CanvasBoard[];
  onCreateNew: () => void;
  onMerge: (boardId: string) => void;
  onClose: () => void;
}

/**
 * Bottom sheet shown after format is picked when existing boards exist.
 * Lets the user choose to create a new board OR merge into an existing one.
 */
const MergePickerModal = ({
  show,
  boards,
  onCreateNew,
  onMerge,
  onClose,
}: MergePickerModalProps) => {
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
                <h2 className="text-lg font-bold text-foreground">Save to…</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Create a new board or add to an existing one
                </p>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl glass" aria-label="Close">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            {/* Create new board */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onCreateNew}
              className="w-full flex items-center gap-3 p-4 rounded-2xl border border-primary/30 bg-primary/5 mb-3 text-left"
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Plus size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Create new board</p>
                <p className="text-xs text-muted-foreground">Start a fresh canvas</p>
              </div>
            </motion.button>

            {/* Existing boards */}
            {boards.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground mb-2 pl-1">Or add to existing:</p>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {boards.map((board) => {
                    const fmt = FORMAT_OPTIONS.find((f) => f.id === board.format);
                    const date = new Date(board.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    });
                    return (
                      <motion.button
                        key={board.id}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onMerge(board.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-2xl glass text-left"
                      >
                        <span className="text-xl shrink-0">{board.characterEmoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{board.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmt?.icon} {fmt?.label} · {date}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MergePickerModal;
