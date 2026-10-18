import "server-only";
import { db, challengeDays, challengeMembers, challengeCheckins, challenges } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { logActivity } from "@/lib/streak";
import { getHighestEarnedReward, CHALLENGE_REWARDS } from "@/lib/challenge-rewards";

type ChallengeMember = typeof challengeMembers.$inferSelect;

export async function ensureRewardTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS challenge_reward_claims (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      challenge_member_id UUID NOT NULL,
      challenge_slug TEXT NOT NULL,
      tier_min_completed INTEGER NOT NULL,
      reward_label TEXT NOT NULL,
      reward_items TEXT NOT NULL,
      earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      claimed_at TIMESTAMPTZ,
      shipped_at TIMESTAMPTZ,
      admin_notes TEXT,
      shipping_name TEXT,
      shipping_line1 TEXT,
      shipping_line2 TEXT,
      shipping_city TEXT,
      shipping_state TEXT,
      shipping_zip TEXT,
      shipping_country TEXT DEFAULT 'US',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(challenge_member_id)
    );
    CREATE INDEX IF NOT EXISTS challenge_reward_claims_user_idx ON challenge_reward_claims (user_id);
    CREATE INDEX IF NOT EXISTS challenge_reward_claims_slug_idx ON challenge_reward_claims (challenge_slug);
  `);
}

/**
 * Check a member in for one challenge day. The single source of truth for
 * both the "Mark day complete" button and finishing a challenge workout
 * video: dupe guard, week-grouped siblings, reward tiers, progress and the
 * activity/streak log.
 *
 * Returns whether this check-in finished the challenge (first time), so the
 * caller can send the member to the celebration page.
 */
export async function checkInChallengeDay(
  me: { id: string; timezone: string | null },
  mem: ChallengeMember,
  dayNumber: number,
): Promise<{ checkedIn: boolean; finishedSlug: string | null; slug: string | null }> {
  const memberId = mem.id;
  // Don't double-log a day
  const [dupe] = await db
    .select()
    .from(challengeCheckins)
    .where(
      and(
        eq(challengeCheckins.challengeMemberId, memberId),
        eq(challengeCheckins.dayNumber, dayNumber)
      )
    )
    .limit(1);
  if (dupe) return { checkedIn: false, finishedSlug: null, slug: null };

  await db.insert(challengeCheckins).values({
    challengeMemberId: memberId,
    dayNumber,
  });

  // Detect week-grouped challenges (same workouts cycle across 7-day blocks)
  const allCDays = await db
    .select({ dayNumber: challengeDays.dayNumber, workoutId: challengeDays.workoutId })
    .from(challengeDays)
    .where(eq(challengeDays.challengeId, mem.challengeId));

  const uniqueWids = new Set(allCDays.map(d => d.workoutId).filter(Boolean));
  const isWeekGrouped = uniqueWids.size > 0 && uniqueWids.size < allCDays.length && allCDays.length > 6;

  if (isWeekGrouped) {
    // Also check in every sibling day in the same week that shares this workout,
    // so completedDays grows correctly and the self-heal can fire.
    const thisDayRow = allCDays.find(d => d.dayNumber === dayNumber);
    if (thisDayRow?.workoutId) {
      const weekStart = Math.floor((dayNumber - 1) / 7) * 7 + 1;
      const weekEnd = weekStart + 6;
      const siblings = allCDays.filter(
        d => d.dayNumber !== dayNumber &&
             d.dayNumber >= weekStart && d.dayNumber <= weekEnd &&
             d.workoutId === thisDayRow.workoutId
      );
      for (const sib of siblings) {
        await db.execute(sql`
          INSERT INTO challenge_checkins (challenge_member_id, day_number)
          SELECT ${memberId}, ${sib.dayNumber}
          WHERE NOT EXISTS (
            SELECT 1 FROM challenge_checkins
            WHERE challenge_member_id = ${memberId} AND day_number = ${sib.dayNumber}
          )
        `);
      }
    }
  }

  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, mem.challengeId))
    .limit(1);

  // ── Reward tier detection ─────────────────────────────────────────
  if (challenge?.slug && CHALLENGE_REWARDS[challenge.slug]) {
    const allMemberCheckins = await db
      .select({ dayNumber: challengeCheckins.dayNumber })
      .from(challengeCheckins)
      .where(eq(challengeCheckins.challengeMemberId, memberId));
    const doneSet = new Set(allMemberCheckins.map(c => c.dayNumber));

    let completedCheckable: number;
    if (isWeekGrouped) {
      completedCheckable = 0;
      const weekCount = Math.ceil(allCDays.length / 7);
      for (let wi = 0; wi < weekCount; wi++) {
        const ws = wi * 7 + 1;
        const we = ws + 6;
        const seenW = new Set<string>();
        const weekDays = allCDays.filter(d => d.dayNumber >= ws && d.dayNumber <= we);
        for (const d of weekDays) {
          if (!d.workoutId || seenW.has(d.workoutId)) continue;
          seenW.add(d.workoutId);
          if (weekDays.some(sd => sd.workoutId === d.workoutId && doneSet.has(sd.dayNumber))) {
            completedCheckable++;
          }
        }
      }
    } else {
      completedCheckable = doneSet.size;
    }

    const earned = getHighestEarnedReward(challenge.slug, completedCheckable);
    if (earned) {
      await ensureRewardTable();
      await db.execute(sql`
        INSERT INTO challenge_reward_claims
          (user_id, challenge_member_id, challenge_slug, tier_min_completed, reward_label, reward_items)
        VALUES
          (${me.id}, ${memberId}, ${challenge.slug}, ${earned.minCompleted}, ${earned.label}, ${earned.items.join(", ")})
        ON CONFLICT (challenge_member_id) DO UPDATE SET
          tier_min_completed = CASE
            WHEN excluded.tier_min_completed > challenge_reward_claims.tier_min_completed
            THEN excluded.tier_min_completed
            ELSE challenge_reward_claims.tier_min_completed
          END,
          reward_label = CASE
            WHEN excluded.tier_min_completed > challenge_reward_claims.tier_min_completed
            THEN excluded.reward_label
            ELSE challenge_reward_claims.reward_label
          END,
          reward_items = CASE
            WHEN excluded.tier_min_completed > challenge_reward_claims.tier_min_completed
            THEN excluded.reward_items
            ELSE challenge_reward_claims.reward_items
          END,
          earned_at = CASE
            WHEN excluded.tier_min_completed > challenge_reward_claims.tier_min_completed
            THEN NOW()
            ELSE challenge_reward_claims.earned_at
          END
      `);
    }
  }
  // ─────────────────────────────────────────────────────────────────

  // The completion threshold is the number of unique (week, workoutId) pairs for
  // week-grouped challenges, or the raw challengeDays count otherwise.
  let totalUnits: number;
  if (isWeekGrouped) {
    const seen = new Set<string>();
    for (const d of allCDays) {
      if (!d.workoutId) continue;
      const weekIdx = Math.floor((d.dayNumber - 1) / 7);
      seen.add(`${weekIdx}:${d.workoutId}`);
    }
    totalUnits = seen.size;
  } else {
    const [{ unitCount }] = await db
      .select({ unitCount: sql<number>`count(*)::int` })
      .from(challengeDays)
      .where(eq(challengeDays.challengeId, mem.challengeId));
    totalUnits = Number(unitCount ?? 0) || (challenge?.durationDays ?? mem.currentDay + 1);
  }
  const proposedNext = mem.currentDay + 1;
  // Always use the challenge's stated duration as the completion threshold.
  // The week-grouped unit count can be lower than durationDays (when workouts
  // repeat across weeks), which caused early-completion for the 45-day challenge.
  const completionThreshold = challenge?.durationDays ?? totalUnits;
  const isComplete = proposedNext > completionThreshold;
  const nextCurrentDay = isComplete ? completionThreshold : proposedNext;
  await db
    .update(challengeMembers)
    .set({
      currentDay: nextCurrentDay,
      completedAt: isComplete && !mem.completedAt ? new Date() : mem.completedAt,
    })
    .where(eq(challengeMembers.id, memberId));

  await logActivity({
    userId: me.id,
    type: "challenge_day_completed",
    referenceId: mem.challengeId,
    meta: { dayNumber },
    timezone: me.timezone ?? undefined,
  });

  return {
    checkedIn: true,
    finishedSlug: isComplete && !mem.completedAt && challenge?.slug ? challenge.slug : null,
    slug: challenge?.slug ?? null,
  };
}
