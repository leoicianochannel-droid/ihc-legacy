/**
 * Admin metrics — pure DB reads computed once per page request.
 * Designed to keep the overview/analytics pages fast: each top-level call
 * pulls the minimum data needed and aggregates in memory.
 */
import {
  db,
  users,
  activityLog,
  subscriptions,
  posts,
  postLikes,
  postComments,
} from "./db";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";

// ── Engagement analytics ──────────────────────────────────────────────────────

export type MemberEngagementRow = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  count: number;
  lastActive: string | null;
};

/** Per-member activity counts for a specific type within a rolling window. */
export async function getMemberEngagementList(
  type: string,
  days: number
): Promise<MemberEngagementRow[]> {
  const since = new Date(Date.now() - days * DAY);
  const rows = await db.execute(sql`
    SELECT
      u.first_name   AS "firstName",
      u.last_name    AS "lastName",
      u.email,
      count(*)::int  AS count,
      max(al.created_at)::text AS "lastActive"
    FROM activity_log al
    JOIN users u ON u.id = al.user_id
    WHERE al.type = ${type}
      AND al.created_at >= ${since.toISOString()}::timestamptz
    GROUP BY u.id, u.first_name, u.last_name, u.email
    ORDER BY count DESC
    LIMIT 300
  `);
  return (rows as unknown as MemberEngagementRow[]).map((r) => ({
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    count: Number(r.count),
    lastActive: r.lastActive,
  }));
}

export type DropoffRow = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  lastActive: string | null;
  prevCount: number;
};

/** Members active in the previous window who have gone quiet in the current window. */
export async function getDropoffMembers(days: number): Promise<DropoffRow[]> {
  const cutoff = new Date(Date.now() - days * DAY);
  const prevStart = new Date(Date.now() - 2 * days * DAY);
  const rows = await db.execute(sql`
    SELECT
      u.first_name   AS "firstName",
      u.last_name    AS "lastName",
      u.email,
      max(al.created_at)::text AS "lastActive",
      count(*)::int  AS "prevCount"
    FROM users u
    JOIN activity_log al ON al.user_id = u.id
      AND al.created_at >= ${prevStart.toISOString()}::timestamptz
      AND al.created_at <  ${cutoff.toISOString()}::timestamptz
    WHERE u.id NOT IN (
      SELECT DISTINCT user_id FROM activity_log
      WHERE created_at >= ${cutoff.toISOString()}::timestamptz
    )
    GROUP BY u.id, u.first_name, u.last_name, u.email
    ORDER BY "lastActive" DESC
    LIMIT 200
  `);
  return (rows as unknown as DropoffRow[]).map((r) => ({
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    lastActive: r.lastActive,
    prevCount: Number(r.prevCount),
  }));
}

export type ChallengeEngagementRow = {
  title: string;
  enrolled: number;
  activeThisWeek: number;
  activeLastWeek: number;
  totalCheckins: number;
};

/** Per-challenge engagement: enrollment + check-in activity this week vs last. */
export async function getChallengeEngagement(): Promise<ChallengeEngagementRow[]> {
  const rows = await db.execute(sql`
    SELECT
      c.title,
      count(DISTINCT cm.user_id)::int AS enrolled,
      count(DISTINCT CASE
        WHEN cc.completed_at >= now() - interval '7 days' THEN cm.user_id
      END)::int AS "activeThisWeek",
      count(DISTINCT CASE
        WHEN cc.completed_at >= now() - interval '14 days'
         AND cc.completed_at <  now() - interval '7 days' THEN cm.user_id
      END)::int AS "activeLastWeek",
      count(cc.id)::int AS "totalCheckins"
    FROM challenges c
    LEFT JOIN challenge_members cm ON cm.challenge_id = c.id
    LEFT JOIN challenge_checkins cc ON cc.challenge_member_id = cm.id
    GROUP BY c.id, c.title
    ORDER BY enrolled DESC
  `);
  return (rows as unknown as ChallengeEngagementRow[]).map((r) => ({
    title: r.title,
    enrolled: Number(r.enrolled),
    activeThisWeek: Number(r.activeThisWeek),
    activeLastWeek: Number(r.activeLastWeek),
    totalCheckins: Number(r.totalCheckins),
  }));
}

const DAY = 24 * 60 * 60 * 1000;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export type OverviewMetrics = {
  totalMembers: number;
  onboardedMembers: number;
  newLast7: number;
  newLast30: number;
  growthLast7vsPrev7Pct: number | null;
  activeSubs: number;
  trialingSubs: number;
  pastDueSubs: number;
  canceledLast30: number;
  churnRate30Pct: number | null;        // canceled30 / activeAtStart
  estMrrUsd: number;
  dau: number;                          // distinct users acting today
  wau: number;                          // distinct users acting in the last 7 days
  mau: number;                          // distinct users acting in the last 30 days
  retention7Pct: number | null;         // % of users who signed up 8-14 days ago and came back since
};

const PRICE_USD = 39.99;

export async function getOverviewMetrics(): Promise<OverviewMetrics> {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const d7 = new Date(now.getTime() - 7 * DAY);
  const d14 = new Date(now.getTime() - 14 * DAY);
  const d30 = new Date(now.getTime() - 30 * DAY);

  // Total + new members
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(users);
  const [{ onboarded }] = await db
    .select({ onboarded: sql<number>`count(*)::int` })
    .from(users)
    .where(sql`${users.onboardedAt} IS NOT NULL`);
  const [{ n7 }] = await db
    .select({ n7: sql<number>`count(*)::int` })
    .from(users)
    .where(and(sql`${users.onboardedAt} IS NOT NULL`, gte(users.onboardedAt!, d7)));
  const [{ n30 }] = await db
    .select({ n30: sql<number>`count(*)::int` })
    .from(users)
    .where(and(sql`${users.onboardedAt} IS NOT NULL`, gte(users.onboardedAt!, d30)));
  const [{ nPrev7 }] = await db
    .select({ nPrev7: sql<number>`count(*)::int` })
    .from(users)
    .where(and(sql`${users.onboardedAt} IS NOT NULL`, gte(users.onboardedAt!, d14), lt(users.onboardedAt!, d7)));
  const growthLast7vsPrev7Pct =
    Number(nPrev7) > 0
      ? Math.round(((Number(n7) - Number(nPrev7)) / Number(nPrev7)) * 100)
      : null;

  // Subscriptions
  const [{ active }] = await db
    .select({ active: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(eq(subscriptions.status, "active"));
  const [{ trialing }] = await db
    .select({ trialing: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(eq(subscriptions.status, "trialing"));
  const [{ pastDue }] = await db
    .select({ pastDue: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(eq(subscriptions.status, "past_due"));
  const [{ canceled30 }] = await db
    .select({ canceled30: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(
      and(eq(subscriptions.status, "canceled"), gte(subscriptions.updatedAt, d30))
    );

  // Churn = canceled in last 30 / (active now + canceled in last 30) — a simple approximation.
  const churnDenom = Number(active) + Number(canceled30);
  const churnRate30Pct =
    churnDenom > 0 ? Math.round((Number(canceled30) / churnDenom) * 1000) / 10 : null;

  // DAU / WAU / MAU — based on activity_log
  const [{ dau }] = await db
    .select({ dau: sql<number>`count(distinct ${activityLog.userId})::int` })
    .from(activityLog)
    .where(gte(activityLog.createdAt, today));
  const [{ wau }] = await db
    .select({ wau: sql<number>`count(distinct ${activityLog.userId})::int` })
    .from(activityLog)
    .where(gte(activityLog.createdAt, d7));
  const [{ mau }] = await db
    .select({ mau: sql<number>`count(distinct ${activityLog.userId})::int` })
    .from(activityLog)
    .where(gte(activityLog.createdAt, d30));

  // 7-day retention: of users who signed up between 8 and 14 days ago, what
  // fraction have logged any activity since their signup + 1 day?
  // We use raw SQL via sql.raw() with ISO-string dates to avoid postgres-js's
  // refusal to bind JS Date objects inside templated fragments.
  const d7Iso = d7.toISOString();
  const d14Iso = d14.toISOString();
  const cohortRows = await db.execute<{
    cohort_size: number;
    returned: number;
  }>(sql`
    SELECT
      count(DISTINCT u.id)::int AS cohort_size,
      count(DISTINCT CASE WHEN a.user_id IS NOT NULL THEN u.id END)::int AS returned
    FROM users u
    LEFT JOIN activity_log a
      ON a.user_id = u.id
     AND a.created_at > u.created_at + interval '1 day'
    WHERE u.created_at >= ${d14Iso}::timestamptz
      AND u.created_at < ${d7Iso}::timestamptz
  `);
  const cohort = (cohortRows as unknown as { cohort_size: number; returned: number }[])[0] ?? {
    cohort_size: 0,
    returned: 0,
  };
  const cohortSize = Number(cohort.cohort_size ?? 0);
  const returned = Number(cohort.returned ?? 0);

  const retention7Pct =
    cohortSize > 0
      ? Math.round((returned / cohortSize) * 1000) / 10
      : null;

  return {
    totalMembers: Number(total),
    onboardedMembers: Number(onboarded),
    newLast7: Number(n7),
    newLast30: Number(n30),
    growthLast7vsPrev7Pct,
    activeSubs: Number(active),
    trialingSubs: Number(trialing),
    pastDueSubs: Number(pastDue),
    canceledLast30: Number(canceled30),
    churnRate30Pct,
    estMrrUsd: Math.round(Number(active) * PRICE_USD),
    dau: Number(dau),
    wau: Number(wau),
    mau: Number(mau),
    retention7Pct,
  };
}

export type ActivityByDay = { date: string; count: number };

export async function getDailyActivityCounts(days = 30): Promise<ActivityByDay[]> {
  const since = new Date(Date.now() - days * DAY);
  const rows = await db
    .select({
      day: sql<string>`(${activityLog.createdAt})::date`,
      count: sql<number>`count(distinct ${activityLog.userId})::int`,
    })
    .from(activityLog)
    .where(gte(activityLog.createdAt, since))
    .groupBy(sql`(${activityLog.createdAt})::date`);
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(String(r.day), Number(r.count));

  // Backfill missing days with 0 so the chart is contiguous.
  const out: ActivityByDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY);
    const key = isoDate(d);
    out.push({ date: key, count: byDay.get(key) ?? 0 });
  }
  return out;
}

export type ActivityBreakdown = { type: string; count: number };

export async function getActivityBreakdown(days = 30): Promise<ActivityBreakdown[]> {
  const since = new Date(Date.now() - days * DAY);
  const rows = await db
    .select({
      type: activityLog.type,
      count: sql<number>`count(*)::int`,
    })
    .from(activityLog)
    .where(gte(activityLog.createdAt, since))
    .groupBy(activityLog.type);
  return rows
    .map((r) => ({ type: String(r.type), count: Number(r.count) }))
    .sort((a, b) => b.count - a.count);
}

export type SignupsByDay = { date: string; count: number };

export async function getSignupsByDay(days = 30): Promise<SignupsByDay[]> {
  const since = new Date(Date.now() - days * DAY);
  const rows = await db
    .select({
      day: sql<string>`(${users.createdAt})::date`,
      count: sql<number>`count(*)::int`,
    })
    .from(users)
    .where(gte(users.createdAt, since))
    .groupBy(sql`(${users.createdAt})::date`);
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(String(r.day), Number(r.count));

  const out: SignupsByDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY);
    const key = isoDate(d);
    out.push({ date: key, count: byDay.get(key) ?? 0 });
  }
  return out;
}

export type CommunityPulse = {
  postsLast7: number;
  commentsLast7: number;
  likesLast7: number;
  topPostAuthors: { firstName: string | null; lastName: string | null; postCount: number }[];
};

export async function getCommunityPulse(): Promise<CommunityPulse> {
  const since = new Date(Date.now() - 7 * DAY);
  const [{ posts7 }] = await db
    .select({ posts7: sql<number>`count(*)::int` })
    .from(posts)
    .where(gte(posts.createdAt, since));
  const [{ comments7 }] = await db
    .select({ comments7: sql<number>`count(*)::int` })
    .from(postComments)
    .where(gte(postComments.createdAt, since));
  const [{ likes7 }] = await db
    .select({ likes7: sql<number>`count(*)::int` })
    .from(postLikes)
    .where(gte(postLikes.createdAt, since));

  const top = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      postCount: sql<number>`count(${posts.id})::int`,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.userId))
    .where(gte(posts.createdAt, since))
    .groupBy(users.id, users.firstName, users.lastName)
    .orderBy(desc(sql`count(${posts.id})`))
    .limit(5);

  return {
    postsLast7: Number(posts7),
    commentsLast7: Number(comments7),
    likesLast7: Number(likes7),
    topPostAuthors: top.map((t) => ({
      firstName: t.firstName,
      lastName: t.lastName,
      postCount: Number(t.postCount),
    })),
  };
}
