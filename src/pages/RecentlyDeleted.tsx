/**
 * Recently Deleted — Trash Bin Page
 *
 * Shows all soft-deleted chat sessions and canvas boards.
 * Items auto-purge after 30 days. Users can restore or permanently delete.
 */

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Trash2, RotateCcw, MessageCircle, Map, Clock, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getTrash, restoreFromTrash, permanentlyDelete, emptyTrash,
  daysUntilPurge, downloadBackup, type TrashedItem,
} from "@/lib/trashStore";
import { upsertSession, type ChatSession } from "@/lib/chatHistoryStore";
import { saveBoard, type CanvasBoard } from "@/lib/canvasStore";
import GlassContainer from "@/components/GlassContainer";

const RecentlyDeleted = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<TrashedItem<any>[]>([]);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: "delete" | "empty" } | null>(null);

  const loadData = useCallback(() => {
    setItems(getTrash());
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRestore = (item: TrashedItem<any>) => {
    const restored = restoreFromTrash(item.id);
    if (!restored) return;

    if (restored.type === "chat") {
      upsertSession(restored.data as ChatSession);
    } else if (restored.type === "canvas") {
      saveBoard(restored.data as CanvasBoard);
    }
    loadData();
  };

  const handlePermanentDelete = (id: string) => {
    permanentlyDelete(id);
    setConfirmAction(null);
    loadData();
  };

  const handleEmptyTrash = () => {
    emptyTrash();
    setConfirmAction(null);
    loadData();
  };

  const chatItems = items.filter((i) => i.type === "chat");
  const canvasItems = items.filter((i) => i.type === "canvas");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-5 pt-12 pb-3 page-header">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl glass"
            aria-label="Back"
          >
            <ChevronLeft size={18} className="text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-foreground">Recently Deleted</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {items.length} item{items.length !== 1 ? "s" : ""} · Auto-deletes after 30 days
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={downloadBackup}
              className="p-2 rounded-xl glass"
              title="Download backup"
            >
              <Download size={16} className="text-foreground/60" />
            </button>
            {items.length > 0 && (
              <button
                onClick={() => setConfirmAction({ id: "", action: "empty" })}
                className="px-3 py-1.5 rounded-xl glass text-xs text-destructive font-medium"
              >
                Empty Trash
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-24">
        {items.length === 0 ? (
          <div className="h-[50vh] flex flex-col items-center justify-center gap-4 text-center">
            <motion.div
              animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-20 h-20 rounded-3xl glass flex items-center justify-center"
            >
              <Trash2 size={32} className="text-primary/60" />
            </motion.div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Trash is empty</h2>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-[260px]">
                Deleted conversations and canvas boards will appear here for 30 days before being permanently removed.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pt-3">
            {/* Chat sessions */}
            {chatItems.length > 0 && (
              <div>
                <GlassContainer variant="dark" size="sm" className="inline-block mb-3">
                  <p className="text-xs font-bold text-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageCircle size={12} /> Chats ({chatItems.length})
                  </p>
                </GlassContainer>
                <div className="space-y-2">
                  <AnimatePresence>
                    {chatItems.map((item) => {
                      const session = item.data as ChatSession;
                      const days = daysUntilPurge(item.deletedAt);
                      const deletedDate = new Date(item.deletedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="glass rounded-2xl p-4 flex items-start gap-3"
                        >
                          <span className="text-xl shrink-0 mt-0.5 opacity-50">{session.characterEmoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground/70 truncate">{session.title}</p>
                            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                              <span>{session.characterName}</span>
                              <span>·</span>
                              <Clock size={9} />
                              <span>Deleted {deletedDate}</span>
                              <span>·</span>
                              <span className={days <= 5 ? "text-destructive font-semibold" : ""}>
                                {days}d left
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleRestore(item)}
                              className="p-2 rounded-xl glass hover:bg-primary/10 transition-colors"
                              title="Restore"
                            >
                              <RotateCcw size={14} className="text-primary" />
                            </button>
                            <button
                              onClick={() => setConfirmAction({ id: item.id, action: "delete" })}
                              className="p-2 rounded-xl glass hover:bg-destructive/10 transition-colors"
                              title="Delete permanently"
                            >
                              <Trash2 size={14} className="text-muted-foreground" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Canvas boards */}
            {canvasItems.length > 0 && (
              <div>
                <GlassContainer variant="dark" size="sm" className="inline-block mb-3">
                  <p className="text-xs font-bold text-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
                    <Map size={12} /> Canvas Boards ({canvasItems.length})
                  </p>
                </GlassContainer>
                <div className="space-y-2">
                  <AnimatePresence>
                    {canvasItems.map((item) => {
                      const board = item.data as CanvasBoard;
                      const days = daysUntilPurge(item.deletedAt);
                      const deletedDate = new Date(item.deletedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="glass rounded-2xl p-4 flex items-start gap-3"
                        >
                          <span className="text-xl shrink-0 mt-0.5 opacity-50">{board.characterEmoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground/70 truncate">{board.title}</p>
                            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                              <span>{board.characterName}</span>
                              <span>·</span>
                              <span>{board.format}</span>
                              <span>·</span>
                              <Clock size={9} />
                              <span>Deleted {deletedDate}</span>
                              <span>·</span>
                              <span className={days <= 5 ? "text-destructive font-semibold" : ""}>
                                {days}d left
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleRestore(item)}
                              className="p-2 rounded-xl glass hover:bg-primary/10 transition-colors"
                              title="Restore"
                            >
                              <RotateCcw size={14} className="text-primary" />
                            </button>
                            <button
                              onClick={() => setConfirmAction({ id: item.id, action: "delete" })}
                              className="p-2 rounded-xl glass hover:bg-destructive/10 transition-colors"
                              title="Delete permanently"
                            >
                              <Trash2 size={14} className="text-muted-foreground" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm modal */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center p-5 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmAction(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-3xl p-6 w-full max-w-xs mb-8"
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-destructive/15 flex items-center justify-center">
                  <Trash2 size={20} className="text-destructive" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {confirmAction.action === "empty" ? "Empty trash?" : "Delete permanently?"}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">
                    {confirmAction.action === "empty"
                      ? "All items in the trash will be permanently deleted. This cannot be undone."
                      : "This item will be permanently deleted. This cannot be undone."}
                  </p>
                </div>
                <div className="flex gap-2 w-full mt-1">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setConfirmAction(null)}
                    className="flex-1 py-2.5 rounded-xl glass text-sm text-muted-foreground font-medium"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() =>
                      confirmAction.action === "empty"
                        ? handleEmptyTrash()
                        : handlePermanentDelete(confirmAction.id)
                    }
                    className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold"
                  >
                    Delete
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RecentlyDeleted;
