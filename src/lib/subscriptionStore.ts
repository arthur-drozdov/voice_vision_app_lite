// Subscription tier management
// Tiers: free (1 board), pro (5 boards + AI gen), premium (unlimited + handwriting)
// Stored in localStorage — swap out for real auth backend later.

export type SubscriptionTier = "free" | "pro" | "premium";

export interface TierConfig {
  label: string;
  boardLimit: number; // -1 = unlimited
  aiGeneration: boolean;
  handwriting: boolean;
  price: string;
  features: string[];
}

export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
  free: {
    label: "Free",
    // NOTE: Limits temporarily disabled for testing — boardLimit and aiGeneration
    // should be restored to (1, false) before production launch.
    boardLimit: -1,
    aiGeneration: true,
    handwriting: false,
    price: "£0/mo",
    features: ["1 Canvas board", "Save conversations", "All 5 characters"],
  },
  pro: {
    label: "Pro",
    boardLimit: 5,
    aiGeneration: true,
    handwriting: false,
    price: "£7.99/mo",
    features: [
      "5 Canvas boards",
      "AI-generated content",
      "All formats (Mindmap, Summary, Calendar…)",
      "Chat history",
      "Board merging",
    ],
  },
  premium: {
    label: "Premium",
    boardLimit: -1,
    aiGeneration: true,
    handwriting: true,
    price: "£14.99/mo",
    features: [
      "Unlimited Canvas boards",
      "Everything in Pro",
      "Handwriting recognition",
      "Voice dictation",
      "Priority support",
    ],
  },
};

const STORAGE_KEY = "subscription-tier";

/** Read the current tier from localStorage (default: "free") */
export function getTier(): SubscriptionTier {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "pro" || raw === "premium" || raw === "free") return raw;
  } catch {}
  return "free";
}

/** Set the tier (for demo: lets devs test all tiers via DevTools) */
export function setTier(tier: SubscriptionTier): void {
  localStorage.setItem(STORAGE_KEY, tier);
}

/** Get the board limit for the current tier (-1 = unlimited) */
export function getBoardLimit(): number {
  return TIER_CONFIGS[getTier()].boardLimit;
}

/** True when the user can create another board */
export function canCreateBoard(currentBoardCount: number): boolean {
  const limit = getBoardLimit();
  return limit === -1 || currentBoardCount < limit;
}

/** True when AI generation is available */
export function hasAIGeneration(): boolean {
  return TIER_CONFIGS[getTier()].aiGeneration;
}

/** True when handwriting recognition is available */
export function hasHandwriting(): boolean {
  return TIER_CONFIGS[getTier()].handwriting;
}
