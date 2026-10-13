/**
 * Tier system — auto-computes the right tier for a user based on
 * (a) total workouts completed, OR
 * (b) longest streak ever achieved.
 * Whichever metric crosses the threshold first.
 *
 * Each tier unlocks a Shopify discount code + perks.
 *
 * IMPORTANT: The discount codes below need to exist in your Shopify
 * dashboard. Create them as one-use-per-customer codes:
 *   - INFINITY-MOVER     → 15% off any product
 *   - INFINITY-CHAMPION  → 25% off any product
 *   - INFINITY-LEGEND    → 30% off any product
 */
import { db, users, activityLog, streaks, tierUnlocks } from "./db";
import { eq, and, sql, count } from "drizzle-orm";

export type Tier = "starter" | "mover" | "champion" | "legend";

export const TIER_CONFIG: Record<
  Tier,
  {
    name: string;
    emoji: string;
    workoutsRequired: number;
    streakRequired: number;
    discount: number;          // % off
    discountCode: string | null;
    perks: string[];
  }
> = {
  starter: {
    name: "Hoop Starter",
    emoji: "🌱",
    workoutsRequired: 0,
    streakRequired: 0,
    discount: 0,
    discountCode: null,
    perks: [
      "Full access to all workouts, recipes, and challenges",
      "Matched accountability buddy",
      "Community + private progress tracking",
    ],
  },
  mover: {
    name: "Hoop Mover",
    emoji: "💫",
    workoutsRequired: 30,
    streakRequired: 30,
    discount: 15,
    discountCode: "INFINITY-MOVER",
    perks: [
      "15% off any infinityhoop.com purchase forever",
      "Mover badge on your community posts",
      "Early access to new recipes",
    ],
  },
  champion: {
    name: "Hoop Champion",
    emoji: "🔥",
    workoutsRequired: 100,
    streakRequired: 100,
    discount: 25,
    discountCode: "INFINITY-CHAMPION",
    perks: [
      "25% off any infinityhoop.com purchase forever",
      "Free Waist Trimmer (we ship it to you — $30 value)",
      "Early access to new challenges",
      "Champion badge on your community posts",
    ],
  },
  legend: {
    name: "Hoop Legend",
    emoji: "👑",
    workoutsRequired: 365,
    streakRequired: 365,
    discount: 30,
    discountCode: "INFINITY-LEGEND",
    perks: [
      "30% off any infinityhoop.com purchase forever",
      "Free Infinity Hoop annual upgrade — any color, any size",
      "Members-only Legend merch",
      "Priority support",
      "Legend badge — your name in gold",
    ],
  },
};

const TIER_ORDER: Tier[] = ["starter", "mover", "champion", "legend"];

/** Returns the highest tier the given workouts/streak qualifies for. */
export function computeTier(workouts: number, longestStreak: number): Tier {
  let earned: Tier = "starter";
  for (const t of TIER_ORDER) {
    const cfg = TIER_CONFIG[t];
    if (workouts >= cfg.workoutsRequired || longestStreak >= cfg.streakRequired) {
      earned = t;
    }
  }
  return earned;
}

/** Pull workout-completed count + longest streak for a user. */
export async function getTierStats(userId: string) {
  const [{ workouts }] = await db
    .select({ workouts: count() })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.userId, userId),
        eq(activityLog.type, "workout_completed")
      )
    );

  const [s] = await db.select().from(streaks).where(eq(streaks.userId, userId)).limit(1);

  return {
    workouts: Number(workouts ?? 0),
    longestStreak: s?.longest ?? 0,
    currentStreak: s?.current ?? 0,
  };
}

/**
 * Returns progress toward the NEXT tier — used in the dashboard widget
 * and the rewards hero progress bar.
 */
export function tierProgress(
  currentTier: Tier,
  workouts: number,
  longestStreak: number
): {
  next: Tier | null;
  pct: number;                 // 0-100 — whichever metric is closer
  workoutsToGo: number;        // 0 if already there or not measured
  streakToGo: number;
} {
  const idx = TIER_ORDER.indexOf(currentTier);
  const next = TIER_ORDER[idx + 1] ?? null;
  if (!next) return { next: null, pct: 100, workoutsToGo: 0, streakToGo: 0 };

  const target = TIER_CONFIG[next];
  const wPct = Math.min(100, Math.floor((workouts / target.workoutsRequired) * 100));
  const sPct = Math.min(100, Math.floor((longestStreak / target.streakRequired) * 100));
  const pct = Math.max(wPct, sPct);
  return {
    next,
    pct,
    workoutsToGo: Math.max(0, target.workoutsRequired - workouts),
    streakToGo: Math.max(0, target.streakRequired - longestStreak),
  };
}

/**
 * Recomputes a user's tier based on current activity, updates the users
 * row, and logs a tier_unlock if they crossed into a new tier. Idempotent.
 *
 * Called from logActivity (every workout/check-in) and on demand when
 * needed (e.g. after a backfill).
 */
export async function recomputeUserTier(userId: string): Promise<{
  tier: Tier;
  unlocked: boolean;
  prev: Tier;
}> {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return { tier: "starter", unlocked: false, prev: "starter" };

  const stats = await getTierStats(userId);
  const newTier = computeTier(stats.workouts, stats.longestStreak);
  const prev = u.tier as Tier;

  // Tier crossings only go UP — don't demote anyone (e.g. if streak resets)
  const newIdx = TIER_ORDER.indexOf(newTier);
  const prevIdx = TIER_ORDER.indexOf(prev);
  if (newIdx <= prevIdx) {
    return { tier: prev, unlocked: false, prev };
  }

  await db
    .update(users)
    .set({ tier: newTier, tierUnlockedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));

  // Record each newly-crossed tier (could cross multiple at once if a big
  // backfill — e.g. starter → champion in one shot).
  for (let i = prevIdx + 1; i <= newIdx; i++) {
    const tier = TIER_ORDER[i];
    await db
      .insert(tierUnlocks)
      .values({
        userId,
        tier,
        workoutsAtUnlock: stats.workouts,
        streakAtUnlock: stats.longestStreak,
      })
      .onConflictDoNothing();
  }

  return { tier: newTier, unlocked: true, prev };
}
