import { db, streaks, activityLog, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { todayInTz } from "./utils";
import type { activityTypeEnum } from "./db/schema";
import { recomputeUserTier } from "./tiers";

type ActivityType = (typeof activityTypeEnum.enumValues)[number];

/**
 * Logs an activity and updates the user's streak in a single operation.
 * Returns the updated streak record so callers can toast "🔥 5 day streak!".
 *
 * Streak rules:
 *   - Any activity on a new day increments the streak
 *   - Multiple activities same day don't double-count
 *   - A gap of 1 full day auto-uses a freeze token if available
 *   - A gap of 2+ days resets streak to 1
 *   - Every 7-day milestone earns a freeze token (capped at MAX_FREEZE_TOKENS)
 */
const MAX_FREEZE_TOKENS = 3;
export async function logActivity(params: {
  userId: string;
  type: ActivityType;
  referenceId?: string;
  meta?: Record<string, unknown>;
  timezone?: string;
}) {
  const today = todayInTz(params.timezone ?? "America/New_York");

  await db.insert(activityLog).values({
    userId: params.userId,
    type: params.type,
    referenceId: params.referenceId ?? null,
    meta: params.meta ?? null,
  });

  const [streak] = await db
    .select()
    .from(streaks)
    .where(eq(streaks.userId, params.userId))
    .limit(1);

  if (!streak) {
    const [fresh] = await db
      .insert(streaks)
      .values({
        userId: params.userId,
        current: 1,
        longest: 1,
        lastActionDate: today,
      })
      .returning();
    return fresh;
  }

  const last = streak.lastActionDate ? String(streak.lastActionDate) : null;

  if (last === today) return streak; // already counted today

  // Compute gap (in days) between last action and today
  let gapDays = 0;
  if (last) {
    const a = new Date(last + "T00:00:00Z");
    const b = new Date(today + "T00:00:00Z");
    gapDays = Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  }

  let newCurrent = streak.current;
  let newFreezes = streak.freezeTokens;

  if (gapDays <= 1) {
    // Continuous
    newCurrent = streak.current + 1;
  } else if (streak.freezeTokens >= gapDays - 1) {
    // Use one freeze token per missed day to bridge the gap
    newCurrent = streak.current + 1;
    newFreezes = streak.freezeTokens - (gapDays - 1);
  } else {
    // Not enough freeze tokens — reset
    newCurrent = 1;
  }

  // Reward consistency: every 7-day milestone grants a freeze token (capped).
  // We award when we cross a multiple of 7 — i.e. previous count was below it
  // and the new count is at-or-above it. This handles the +1 case naturally.
  const prevMilestones = Math.floor(streak.current / 7);
  const newMilestones = Math.floor(newCurrent / 7);
  if (newMilestones > prevMilestones) {
    newFreezes = Math.min(MAX_FREEZE_TOKENS, newFreezes + (newMilestones - prevMilestones));
  }

  const newLongest = Math.max(newCurrent, streak.longest);

  const [updated] = await db
    .update(streaks)
    .set({
      current: newCurrent,
      longest: newLongest,
      lastActionDate: today,
      freezeTokens: newFreezes,
      updatedAt: new Date(),
    })
    .where(eq(streaks.userId, params.userId))
    .returning();

  // Check if this activity unlocks a new tier (fire-and-forget; failure here
  // shouldn't break the activity log itself).
  recomputeUserTier(params.userId).catch((err) =>
    console.warn("Tier recompute failed for", params.userId, err)
  );

  return updated;
}

/** Look up streak + user row together. */
export async function getUserStreak(clerkId: string) {
  const [row] = await db
    .select({ user: users, streak: streaks })
    .from(users)
    .leftJoin(streaks, eq(streaks.userId, users.id))
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return row;
}
