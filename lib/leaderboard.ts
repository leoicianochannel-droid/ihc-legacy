/**
 * Computes weekly leaderboards from existing tables — no new schema.
 *
 * Three boards:
 *  - Most Workouts: top by `workout_completed` events in the last 7 days
 *  - Longest Streak: top by current streak
 *  - Most Encouraging: top by comments authored in the last 7 days
 *
 * Effort-only metrics. We deliberately do NOT rank by weight loss or
 * inches — those should be private and never weaponized for competition.
 */
import { db, users, activityLog, streaks, postComments, challengeCheckins, challengeMembers, challenges } from "./db";
import { and, desc, eq, gte, sql } from "drizzle-orm";

const CHALLENGE_SLUG = "30-day-challenge";
const CURRENT_RUN_START = new Date("2026-07-01T00:00:00Z");

const DAY = 24 * 60 * 60 * 1000;

export type LeaderRow = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  tier: string | null;
  count: number;                  // metric value
};

const LIMIT = 10;

function sinceWeekAgo(): Date {
  return new Date(Date.now() - 7 * DAY);
}

export async function topByWorkouts(): Promise<LeaderRow[]> {
  const rows = await db
    .select({
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
      tier: users.tier,
      count: sql<number>`count(${activityLog.id})::int`,
    })
    .from(activityLog)
    .innerJoin(users, eq(users.id, activityLog.userId))
    .where(
      and(
        eq(activityLog.type, "workout_completed"),
        gte(activityLog.createdAt, sinceWeekAgo())
      )
    )
    .groupBy(users.id, users.firstName, users.lastName, users.avatarUrl, users.tier)
    .orderBy(desc(sql`count(${activityLog.id})`))
    .limit(LIMIT);
  return rows.map((r) => ({ ...r, count: Number(r.count) }));
}

export async function topByStreak(): Promise<LeaderRow[]> {
  const rows = await db
    .select({
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
      tier: users.tier,
      count: streaks.current,
    })
    .from(streaks)
    .innerJoin(users, eq(users.id, streaks.userId))
    .where(sql`${streaks.current} > 0`)
    .orderBy(desc(streaks.current))
    .limit(LIMIT);
  return rows.map((r) => ({ ...r, count: Number(r.count) }));
}

export async function topByChallengeCheckins(): Promise<LeaderRow[]> {
  const [challenge] = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(eq(challenges.slug, CHALLENGE_SLUG))
    .limit(1);
  if (!challenge) return [];

  const rows = await db
    .select({
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
      tier: users.tier,
      count: sql<number>`count(${challengeCheckins.id})::int`,
    })
    .from(challengeCheckins)
    .innerJoin(challengeMembers, eq(challengeCheckins.challengeMemberId, challengeMembers.id))
    .innerJoin(users, eq(challengeMembers.userId, users.id))
    .where(
      and(
        eq(challengeMembers.challengeId, challenge.id),
        gte(challengeCheckins.completedAt, CURRENT_RUN_START)
      )
    )
    .groupBy(users.id, users.firstName, users.lastName, users.avatarUrl, users.tier)
    .orderBy(desc(sql`count(${challengeCheckins.id})`))
    .limit(LIMIT);
  return rows.map((r) => ({ ...r, count: Number(r.count) }));
}

export async function topByEncouragement(): Promise<LeaderRow[]> {
  const rows = await db
    .select({
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
      tier: users.tier,
      count: sql<number>`count(${postComments.id})::int`,
    })
    .from(postComments)
    .innerJoin(users, eq(users.id, postComments.userId))
    .where(gte(postComments.createdAt, sinceWeekAgo()))
    .groupBy(users.id, users.firstName, users.lastName, users.avatarUrl, users.tier)
    .orderBy(desc(sql`count(${postComments.id})`))
    .limit(LIMIT);
  return rows.map((r) => ({ ...r, count: Number(r.count) }));
}
