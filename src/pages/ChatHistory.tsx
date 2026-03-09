import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Trash2, Clock, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getSessions, deleteSession, type ChatSession } from "@/lib/chatHistoryStore";

const PENDING_LOAD_KEY = "pending-load-session";

const ChatHistory = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setSessions(getSessions());
  }, []);

  useEffect(() => {
    loadData();
    window.addEventListener("storage", loadData);
    return () => window.removeEventListener("storage", loadData);
  }, [loadData]);

  const handleTapSession = (session: ChatSession) => {
    localStorage.setItem(PENDING_LOAD_KEY, JSON.stringify({ sessionId: session.id }));
    navigate("/chat");
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (!deleteConfirmId) return;
    deleteSession(deleteConfirmId);
    loadData();
    setDeleteConfirmId(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-5 pt-12 pb-3 page-header">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/chat")}
            className="p-2 rounded-xl glass"
            aria-label="Back"
          >
            <ChevronLeft size={18} className="text-foreground" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Chat History</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sessions.length} conversation{sessions.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </header>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-5 pb-32">
        {sessions.length === 0 ? (
          <div className="h-[50vh] flex flex-col items-center justify-center gap-4 text-center">
            <motion.div
              animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-20 h-20 rounded-3xl glass flex items-center justify-center"
            >
              <MessageCircle size={32} className="text-primary/60" />
            </motion.div>
            <div>
              <h2 className="text-base font-semibold text-foreground">No history yet</h2>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-[220px]">
                Your chat sessions will appear here after you start a conversation.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-3">
            <AnimatePresence>
              {sessions.map((session, idx) => {
                const date = new Date(
                  Number(session.updatedAt) || session.updatedAt
                ).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });
                const preview =
                  session.messages.find((m) => m.role === "agent")?.text?.slice(0, 90) ?? "";

                return (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => handleTapSession(session)}
                    className="glass rounded-2xl p-4 flex items-start gap-3 cursor-pointer active:scale-[0.98] transition-transform"
                  >
                    <span className="text-2xl shrink-0 mt-0.5">{session.characterEmoji}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {session.title}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5 w-fit bg-background/60 rounded px-1.5 py-px">
                        <span className="text-xs text-muted-foreground">
                          {session.characterName}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <Clock size={10} className="text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{date}</span>
                      </div>
                      {preview && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                          {preview}
                          {preview.length >= 90 ? "…" : ""}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleDelete(session.id, e)}
                      className="p-2 rounded-xl glass shrink-0 opacity-40 hover:opacity-80 transition-opacity"
                    >
                      <Trash2 size={13} className="text-muted-foreground" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center p-5 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteConfirmId(null)}
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
                    Delete this conversation?
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">
                    This will{" "}
                    <span className="text-destructive font-semibold">permanently delete</span>{" "}
                    this conversation. This cannot be undone.
                  </p>
                </div>
                <div className="flex gap-2 w-full mt-1">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 py-2.5 rounded-xl glass text-sm text-muted-foreground font-medium"
                  >
                    Keep it
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={confirmDelete}
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

export default ChatHistory;
