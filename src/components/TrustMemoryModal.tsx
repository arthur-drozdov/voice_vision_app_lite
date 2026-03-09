/**
 * Trust & Memory Consent Modal
 *
 * A warm, multi-step onboarding flow that introduces the Memory feature.
 * The user feels safe, understood, and in full control.
 *
 * Steps:
 *   1. Welcome — warm intro explaining WHY we remember
 *   2. Toggles — 5 granular category switches + preview
 *   3. Confirmation — summary + privacy shield + "easy exit" promise
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ShieldCheck, Pause, Play, Eye, ChevronRight, ChevronLeft, X } from "lucide-react";
import {
  MemoryCategory,
  MemoryPermissions,
  MEMORY_CATEGORIES,
  getPermissions,
  savePermissions,
  completeOnboarding,
} from "@/lib/memoryPermissions";

/* ─── Props ───────────────────────────────────────────────────────────────── */
interface TrustMemoryModalProps {
  show: boolean;
  onComplete: () => void;
}

/* ─── Slide animation variants ────────────────────────────────────────────── */
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 200 : -200,
    opacity: 0,
  }),
  centre: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -200 : 200,
    opacity: 0,
  }),
};

/* ─── Component ───────────────────────────────────────────────────────────── */

const TrustMemoryModal = ({ show, onComplete }: TrustMemoryModalProps) => {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [perms, setPerms] = useState<MemoryPermissions>(getPermissions);
  const [previewCategory, setPreviewCategory] = useState<MemoryCategory | null>(null);

  if (!show) return null;

  const totalSteps = 3;

  const goNext = () => {
    if (step < totalSteps - 1) {
      setDirection(1);
      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (step > 0) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  const toggleCategory = (key: MemoryCategory) => {
    setPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePause = () => {
    setPerms((prev) => ({ ...prev, paused: !prev.paused }));
  };

  const handleComplete = () => {
    savePermissions({ ...perms, onboardingComplete: true });
    completeOnboarding();
    onComplete();
  };

  const enabledCount = MEMORY_CATEGORIES.filter((c) => perms[c.key]).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleComplete}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="relative w-full max-w-sm glass rounded-3xl overflow-hidden"
      >
        {/* Close button */}
        <button
          onClick={handleComplete}
          className="absolute top-4 right-4 p-1.5 rounded-full text-foreground/40 hover:text-foreground/70 transition-colors z-10"
        >
          <X size={16} />
        </button>

        {/* Step indicator */}
        <div className="flex justify-centre gap-1.5 pt-5 px-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full flex-1 transition-colors duration-300 ${
                i <= step ? "bg-primary" : "bg-foreground/10"
              }`}
            />
          ))}
        </div>

        {/* Steps */}
        <div className="px-6 py-5 min-h-[380px] flex flex-col">
          <AnimatePresence mode="wait" custom={direction}>
            {step === 0 && (
              <motion.div
                key="welcome"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="centre"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="flex-1 flex flex-col items-center justify-center text-center gap-4"
              >
                {/* Privacy Shield */}
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center"
                >
                  <Shield size={36} className="text-primary" />
                </motion.div>

                <h2 className="text-xl font-bold text-foreground">Your Memory, Your Rules</h2>

                <p className="text-sm text-foreground/70 leading-relaxed max-w-[280px]">
                  We can remember things about you — your interests, your goals, even how you're feeling — 
                  so every conversation feels more <span className="font-semibold text-foreground">personal</span> and <span className="font-semibold text-foreground">meaningful</span>.
                </p>

                <p className="text-xs text-foreground/50 leading-relaxed max-w-[260px]">
                  You choose exactly what we remember. Nothing is stored without your say-so, and you can 
                  change your mind at any time.
                </p>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="toggles"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="centre"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="flex-1 flex flex-col gap-3"
              >
                <h2 className="text-base font-bold text-foreground mb-1">Choose what to remember</h2>

                {MEMORY_CATEGORIES.map((cat) => (
                  <div key={cat.key} className="flex items-start gap-3">
                    {/* Toggle */}
                    <button
                      onClick={() => toggleCategory(cat.key)}
                      className={`mt-0.5 w-10 h-5 rounded-full shrink-0 relative transition-colors duration-200 ${
                        perms[cat.key] ? "bg-primary" : "bg-foreground/15"
                      }`}
                    >
                      <motion.div
                        animate={{ x: perms[cat.key] ? 20 : 2 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
                      />
                    </button>

                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{cat.emoji}</span>
                        <span className="text-xs font-semibold text-foreground">{cat.label}</span>
                        {cat.sensitive && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-400 font-bold">
                            SENSITIVE
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-foreground/55 leading-snug mt-0.5">{cat.description}</p>
                    </div>

                    {/* Preview button */}
                    <button
                      onClick={() => setPreviewCategory(previewCategory === cat.key ? null : cat.key)}
                      className="mt-0.5 p-1 rounded-lg text-foreground/30 hover:text-foreground/60 transition-colors shrink-0"
                      title="Preview what we'd remember"
                    >
                      <Eye size={13} />
                    </button>
                  </div>
                ))}

                {/* Preview panel */}
                <AnimatePresence>
                  {previewCategory && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                        <p className="text-[10px] text-foreground/40 font-semibold uppercase tracking-wider mb-1">
                          Preview — what we'd remember
                        </p>
                        <p className="text-xs text-foreground/70 italic leading-relaxed">
                          {MEMORY_CATEGORIES.find((c) => c.key === previewCategory)?.preview}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Pause All */}
                <button
                  onClick={togglePause}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    perms.paused
                      ? "bg-amber-400/15 text-amber-400"
                      : "bg-foreground/5 text-foreground/50 hover:text-foreground/70"
                  }`}
                >
                  {perms.paused ? <Play size={13} /> : <Pause size={13} />}
                  {perms.paused ? "Resume All Memory" : "Pause All Memory"}
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="confirm"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="centre"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="flex-1 flex flex-col items-center justify-center text-center gap-4"
              >
                {/* Animated shield — fills in when toggles active */}
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  className={`w-20 h-20 rounded-full flex items-center justify-center ${
                    enabledCount > 0 ? "bg-emerald-400/15" : "bg-foreground/5"
                  }`}
                >
                  {enabledCount > 0 ? (
                    <ShieldCheck size={36} className="text-emerald-400" />
                  ) : (
                    <Shield size={36} className="text-foreground/30" />
                  )}
                </motion.div>

                <h2 className="text-lg font-bold text-foreground">You're all set!</h2>

                {enabledCount > 0 ? (
                  <p className="text-sm text-foreground/70 leading-relaxed max-w-[280px]">
                    You've enabled <span className="font-bold text-foreground">{enabledCount}</span> memory{" "}
                    {enabledCount === 1 ? "category" : "categories"}. We'll only remember what you've chosen.
                  </p>
                ) : (
                  <p className="text-sm text-foreground/70 leading-relaxed max-w-[280px]">
                    You haven't enabled any memory categories yet — that's perfectly fine! 
                    Your experience will still be wonderful, just less personalised.
                  </p>
                )}

                {perms.paused && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400/15 text-amber-400 text-xs font-medium">
                    <Pause size={12} />
                    Memory is currently paused
                  </div>
                )}

                <p className="text-[11px] text-foreground/40 leading-relaxed max-w-[250px]">
                  You can change your mind at any time in the <span className="font-semibold">Memory Sanctuary</span> — 
                  it's always just a tap away.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation buttons */}
        <div className="px-6 pb-5 flex items-center justify-between">
          {step > 0 ? (
            <button
              onClick={goBack}
              className="flex items-center gap-1 text-xs text-foreground/50 hover:text-foreground/80 transition-colors font-medium"
            >
              <ChevronLeft size={14} />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < totalSteps - 1 ? (
            <button
              onClick={goNext}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Continue
              <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="flex items-center gap-1 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Let's go! ✨
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default TrustMemoryModal;
