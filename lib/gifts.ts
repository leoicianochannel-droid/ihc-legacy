import type { GiftClaim } from "./db/schema";

// ─── Milestone type ───────────────────────────────────────────────────────────

export type GiftMilestone = {
  key: string;
  dayThreshold: number;
  label: string;
  fullLabel: string;
  description: string;
  emoji: string;
  retailValue: string;
  requiresShipping: boolean;
  image: string | null;
};

// ─── Static seed / fallback milestones ───────────────────────────────────────
// Used when the DB table is empty and as initial seed data.

export const GIFT_MILESTONES: GiftMilestone[] = [
  {
    key: "month_2_tea",
    dayThreshold: 60,
    label: "Detox Tea",
    fullLabel: "Free 30 Day Detox Tea",
    description: "Our 30 day detox tea, shipped free to your door.",
    emoji: "🍵",
    retailValue: "$39.99",
    requiresShipping: true,
    image: "https://cdn.shopify.com/s/files/1/0564/5015/4685/files/72.png?v=1773823074",
  },
  {
    key: "month_3_arm_hoops",
    dayThreshold: 90,
    label: "Arm Trimmers",
    fullLabel: "Free Arm Trimmers",
    description: "A pair of Infinity Arm Trimmers, shipped free to your door.",
    emoji: "💪",
    retailValue: "$29.99",
    requiresShipping: true,
    image: "https://cdn.shopify.com/s/files/1/0564/5015/4685/files/Untitleddesign_31.png?v=1753580615",
  },
  {
    key: "month_4_free_month",
    dayThreshold: 120,
    label: "Free Month",
    fullLabel: "Free Month of Community",
    description: "A free month of membership, applied to your next bill.",
    emoji: "🎁",
    retailValue: "$29.99",
    requiresShipping: false,
    image: null,
  },
];

export type MilestoneKey = string;

// ─── DB fetch (server-only) ───────────────────────────────────────────────────

export async function getDbMilestones(): Promise<GiftMilestone[]> {
  try {
    const { db, giftMilestones } = await import("./db");
    const { eq, asc } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(giftMilestones)
      .where(eq(giftMilestones.isActive, true))
      .orderBy(asc(giftMilestones.dayThreshold));
    if (rows.length === 0) return GIFT_MILESTONES;
    return rows.map((r) => ({
      key: r.key,
      dayThreshold: r.dayThreshold,
      label: r.label,
      fullLabel: r.fullLabel,
      description: r.description,
      emoji: r.emoji,
      retailValue: r.retailValue,
      requiresShipping: r.requiresShipping,
      image: r.imageUrl,
    }));
  } catch {
    return GIFT_MILESTONES;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Days since a date (floored to whole days). */
export function daysSince(date: Date | string): number {
  const ms = Date.now() - new Date(date).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export type GiftStatus = {
  /** Milestones the user has unlocked but NOT yet claimed (ready to claim). */
  readyToClaim: GiftMilestone[];
  /** The next upcoming milestone they haven't unlocked yet. */
  nextUpcoming: { milestone: GiftMilestone; daysLeft: number } | null;
  /** All milestones fully claimed + shipped. */
  allComplete: boolean;
  /** Days since they joined. */
  daysMember: number;
};

/**
 * Calculate the full gift milestone status for a member.
 * @param startDate  onboardedAt (or createdAt as fallback)
 * @param claims     rows from gift_claims for this user
 * @param milestones milestone definitions (defaults to static GIFT_MILESTONES)
 */
export function getGiftStatus(
  startDate: Date | string | null,
  claims: GiftClaim[],
  milestones: GiftMilestone[] = GIFT_MILESTONES
): GiftStatus {
  if (!startDate) {
    return { readyToClaim: [], nextUpcoming: null, allComplete: false, daysMember: 0 };
  }

  const daysMember = daysSince(startDate);
  const claimedKeys = new Set(claims.filter((c) => c.claimedAt).map((c) => c.milestoneKey));

  const readyToClaim = milestones.filter(
    (m) => daysMember >= m.dayThreshold && !claimedKeys.has(m.key)
  );

  const upcoming = milestones
    .filter((m) => daysMember < m.dayThreshold && !claimedKeys.has(m.key))
    .sort((a, b) => a.dayThreshold - b.dayThreshold)[0];

  const nextUpcoming = upcoming
    ? { milestone: upcoming, daysLeft: upcoming.dayThreshold - daysMember }
    : null;

  const allComplete =
    milestones.every((m) => claimedKeys.has(m.key)) && readyToClaim.length === 0;

  return { readyToClaim, nextUpcoming, allComplete, daysMember };
}
