/**
 * Memory Sanctuary
 *
 * A calm, respectful settings page where the user can
 * review and manage all their memory permissions at any time.
 * Accessible from Customise → Memory Sanctuary.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, ShieldCheck, Pause, Play, Eye, Trash2 } from "lucide-react";
import GlassContainer from "@/components/GlassContainer";
import FocusButton from "@/components/FocusButton";
import {
  MemoryCategory,
  MemoryPermissions,
  MEMORY_CATEGORIES,
  getPermissions,
  savePermissions,
} from "@/lib/memoryPermissions";

const MemorySanctuary = () => {
  const navigate = useNavigate();
  const [perms, setPerms] = useState<MemoryPermissions>(getPermissions);
  const [previewCat, setPreviewCat] = useState<MemoryCategory | null>(null);

  const enabledCount = MEMORY_CATEGORIES.filter((c) => perms[c.key]).length;

  const toggleCategory = (key: MemoryCategory) => {
    const updated = { ...perms, [key]: !perms[key] };
    setPerms(updated);
    savePermissions(updated);
  };

  const togglePause = () => {
    const updated = { ...perms, paused: !perms.paused };
    setPerms(updated);
    savePermissions(updated);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <header className="px-5 pt-12 pb-4 page-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl glass active:scale-95 transition-transform"
            >
              <ArrowLeft size={18} className="text-foreground" />
            </button>
            <GlassContainer variant="dark" size="sm" className="inline-block">
              <h1 className="text-lg font-bold text-foreground">Memory Sanctuary</h1>
              <p className="text-xs text-foreground/50">Your data, your rules — always</p>
            </GlassContainer>
          </div>
          <FocusButton />
        </div>
      </header>

      <div className="px-5 pb-32 space-y-5">
        {/* Status card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-5 flex items-center gap-4"
        >
          <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${
            perms.paused ? "bg-amber-400/15" : enabledCount > 0 ? "bg-emerald-400/15" : "bg-foreground/5"
          }`}>
            {perms.paused ? (
              <Pause size={24} className="text-amber-400" />
            ) : enabledCount > 0 ? (
              <ShieldCheck size={24} className="text-emerald-400" />
            ) : (
              <Shield size={24} className="text-foreground/30" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-foreground">
              {perms.paused
                ? "Memory is paused"
                : enabledCount > 0
                ? `${enabledCount} ${enabledCount === 1 ? "category" : "categories"} active`
                : "No memory enabled"
              }
            </h2>
            <p className="text-xs text-foreground/50 mt-0.5">
              {perms.paused
                ? "No new data is being stored. Your history is safe."
                : enabledCount > 0
                ? "Your AI remembers only what you've allowed."
                : "Enable categories below to personalise your experience."
              }
            </p>
          </div>
        </motion.div>

        {/* Pause/Resume All */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          onClick={togglePause}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors ${
            perms.paused
              ? "bg-emerald-400/15 text-emerald-400 hover:bg-emerald-400/25"
              : "bg-amber-400/15 text-amber-400 hover:bg-amber-400/25"
          }`}
        >
          {perms.paused ? <Play size={16} /> : <Pause size={16} />}
          {perms.paused ? "Resume All Memory" : "Pause All Memory"}
        </motion.button>

        {/* Category toggles */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-foreground/50 uppercase tracking-wider px-1">
            Memory Categories
          </h3>

          {MEMORY_CATEGORIES.map((cat, i) => (
            <motion.div
              key={cat.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.04 }}
              className="glass rounded-2xl p-4"
            >
              <div className="flex items-start gap-3">
                {/* Toggle switch */}
                <button
                  onClick={() => toggleCategory(cat.key)}
                  className={`mt-0.5 w-11 h-6 rounded-full shrink-0 relative transition-colors duration-200 ${
                    perms[cat.key] ? "bg-primary" : "bg-foreground/15"
                  }`}
                >
                  <motion.div
                    animate={{ x: perms[cat.key] ? 22 : 3 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                  />
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>{cat.emoji}</span>
                    <span className="text-sm font-semibold text-foreground">{cat.label}</span>
                    {cat.sensitive && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-400 font-bold">
                        SENSITIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-foreground/55 leading-snug mt-1">{cat.description}</p>

                  {/* Actions row */}
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={() => setPreviewCat(previewCat === cat.key ? null : cat.key)}
                      className="flex items-center gap-1 text-[10px] text-foreground/40 hover:text-foreground/70 transition-colors font-medium"
                    >
                      <Eye size={11} />
                      Preview
                    </button>
                    <button
                      className="flex items-center gap-1 text-[10px] text-foreground/30 hover:text-red-400 transition-colors font-medium"
                      title="Delete memories in this category (coming soon)"
                    >
                      <Trash2 size={11} />
                      Clear data
                    </button>
                  </div>
                </div>
              </div>

              {/* Preview panel */}
              {previewCat === cat.key && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="mt-3 p-3 rounded-xl bg-primary/5 border border-primary/10"
                >
                  <p className="text-[10px] text-foreground/40 font-semibold uppercase tracking-wider mb-1">
                    Example of what we'd remember
                  </p>
                  <p className="text-xs text-foreground/70 italic leading-relaxed">{cat.preview}</p>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Reassurance footer */}
        <div className="text-centre pt-2 pb-4">
          <p className="text-[11px] text-foreground/35 leading-relaxed text-center">
            Your memories are stored securely on your device.
            <br />
            You're always in control — that's a promise. 💙
          </p>
        </div>
      </div>
    </div>
  );
};

export default MemorySanctuary;
