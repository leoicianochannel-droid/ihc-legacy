export type RewardTier = {
  minCompleted: number;
  label: string;
  items: string[];
  emoji: string;
};

// Keys must match the `slug` field in the challenges table.
export const CHALLENGE_REWARDS: Record<string, RewardTier[]> = {
  "21-day-reset": [
    { minCompleted: 15, label: "15-Day Reward",     items: ["Waist Trimmer Belt"],                                emoji: "🎁" },
    { minCompleted: 21, label: "21-Day Completion",  items: ["GLP-1 Patches", "Arm Hoop"],                        emoji: "🏆" },
  ],
  "75-hard": [
    { minCompleted: 7,  label: "7-Day Reward",       items: ["50g Slimming Cream"],                               emoji: "🎁" },
    { minCompleted: 21, label: "21-Day Reward",      items: ["Knee Compression Pads"],                            emoji: "🎁" },
    { minCompleted: 50, label: "50-Day Reward",      items: ["50g Slimming Cream"],                               emoji: "🎁" },
    { minCompleted: 75, label: "75-Day Completion",  items: ["GLP-1 Patches", "Arm Hoop", "50g Slimming Cream"],  emoji: "🏆" },
  ],
};

/** Returns the highest-tier reward the member has earned, or null if none. */
export function getHighestEarnedReward(slug: string, completedCount: number): RewardTier | null {
  const tiers = CHALLENGE_REWARDS[slug];
  if (!tiers) return null;
  const earned = tiers.filter(t => completedCount >= t.minCompleted);
  if (earned.length === 0) return null;
  return earned.reduce((best, t) => t.minCompleted > best.minCompleted ? t : best);
}

/** Returns the next reward tier the member hasn't earned yet, with `remaining` days left. */
export function getNextReward(
  slug: string,
  completedCount: number,
): (RewardTier & { remaining: number }) | null {
  const tiers = CHALLENGE_REWARDS[slug];
  if (!tiers) return null;
  const next = tiers
    .filter(t => completedCount < t.minCompleted)
    .sort((a, b) => a.minCompleted - b.minCompleted)[0];
  if (!next) return null;
  return { ...next, remaining: next.minCompleted - completedCount };
}
