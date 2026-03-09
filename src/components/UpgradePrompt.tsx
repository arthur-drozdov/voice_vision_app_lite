import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Check } from "lucide-react";
import { TIER_CONFIGS, getTier, setTier, SubscriptionTier } from "@/lib/subscriptionStore";

interface UpgradePromptProps {
  show: boolean;
  onClose: () => void;
  /** Optional: which feature triggered the prompt */
  reason?: string;
}

/**
 * Full-screen upgrade overlay shown when user hits their subscription limit.
 * Shows a tier comparison and lets the user "upgrade" (demo: persists tier to localStorage).
 */
const UpgradePrompt = ({ show, onClose, reason }: UpgradePromptProps) => {
  const currentTier = getTier();

  const handleUpgrade = (tier: SubscriptionTier) => {
    // In production: redirect to payment page. For now, persist for demo.
    setTier(tier);
    onClose();
  };

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 glass rounded-t-3xl px-6 pt-6 pb-12 max-h-[85vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Sparkles size={16} className="text-primary" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Upgrade your plan</h2>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl glass" aria-label="Close">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            {reason && (
              <p className="text-sm text-muted-foreground mb-5">
                {reason}
              </p>
            )}

            {/* Tier cards */}
            <div className="space-y-3 mt-4">
              {(["pro", "premium"] as SubscriptionTier[]).map((tier) => {
                const config = TIER_CONFIGS[tier];
                const isCurrent = currentTier === tier;
                const isPremium = tier === "premium";
                return (
                  <div
                    key={tier}
                    className={`rounded-2xl border p-4 ${
                      isPremium
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/40 glass"
                    }`}
                  >
                    {/* Tier header */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{config.label}</span>
                          {isPremium && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">
                              BEST
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{config.price}</span>
                      </div>
                      {isCurrent ? (
                        <span className="text-xs px-3 py-1.5 rounded-xl glass text-muted-foreground">
                          Current
                        </span>
                      ) : (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleUpgrade(tier)}
                          className={`text-xs px-3 py-1.5 rounded-xl font-semibold ${
                            isPremium
                              ? "bg-primary text-primary-foreground glow-primary"
                              : "glass text-foreground"
                          }`}
                        >
                          Upgrade
                        </motion.button>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="space-y-1.5">
                      {config.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-xs text-foreground">
                          <Check size={12} className="text-primary shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* Stay on free */}
            <button
              onClick={onClose}
              className="w-full mt-4 py-3 text-sm text-muted-foreground"
            >
              Stay on Free plan
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default UpgradePrompt;
