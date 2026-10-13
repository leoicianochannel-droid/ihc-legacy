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

  // 7-day retention: of members who finished onboarding between 8 and 14 days
  // ago, what fraction have logged any activity since onboarding + 1 day?
  // (Uses onboarded_at, not created_at — created_at also includes the Skio
  // "shadow users" the webhook pre-creates for every buyer.)
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
     AND a.created_at > u.onboarded_at + interval '1 day'
    WHERE u.onboarded_at >= ${d14Iso}::timestamptz
      AND u.onboarded_at < ${d7Iso}::timestamptz
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

// ── Community health ─────────────────────────────────────────────────────────
//
// Everything below is scoped to COMMUNITY MEMBERS only: people who created an
// account on the app and finished onboarding (users.onboarded_at IS NOT NULL),
// excluding admins/coaches. The subscriptions table also holds every Skio
// subscriber the webhook has ever seen (a "shadow user" is created for each
// buyer), most of whom never joined the community — those are ignored here.
//
// A member is "paying" if any of their subscription rows is active, trialing
// or past_due. A member has "churned" if they have a canceled subscription and
// nothing currently paying. We don't store a dedicated cancel timestamp, so the
// canceled row's updated_at is used as the cancel date.

export type ChurnMonth = {
  month: string;          // YYYY-MM
  startPaying: number;    // paying at the start of the month
  joined: number;         // started paying during the month
  churned: number;        // canceled during the month
  churnPct: number | null;
};

export type JoinCohort = {
  month: string;          // YYYY-MM, by onboarding date
  joined: number;
  stillPaying: number;
  stillPayingPct: number | null;
  activeLast30: number;
  activeLast30Pct: number | null;
};

export type CommunityHealth = {
  members: number;            // onboarded community members (all time)
  paying: number;             // active + trialing + past_due
  trialing: number;
  pastDue: number;
  comp: number;               // not paying, but on free/beta access
  churnedAllTime: number;
  churnedLast30: number;
  churnRate30Pct: number | null;   // churnedLast30 / (paying + churnedLast30)
  newPayingLast30: number;
  netChangeLast30: number;
  dau: number;                // paying members with activity today
  wau: number;                // … last 7 days
  mau: number;                // … last 30 days
  dailyRegulars: number;      // paying members active on 5+ of the last 7 days
  goneQuiet14: number;        // paying, has used the app, but nothing in 14+ days
  neverActive: number;        // paying, zero activity ever
  estMrrUsd: number;          // (paying − trialing) × PRICE_USD
  pricePerMemberUsd: number;
  nonCommunitySubs: number;   // active subscription rows NOT tied to a community member
  churnByMonth: ChurnMonth[];
  cohorts: JoinCohort[];
};

const pct = (n: number, d: number) =>
  d > 0 ? Math.round((n / d) * 1000) / 10 : null;

// Per-member rollup reused by every community-health query.
const MEMBER_STATUS_CTE = sql`
  members AS (
    SELECT u.id, u.onboarded_at, u.free_access_until
    FROM users u
    WHERE u.onboarded_at IS NOT NULL
      AND u.role = 'member'
  ),
  member_status AS (
    SELECT
      m.id,
      m.onboarded_at,
      m.free_access_until,
      coalesce(bool_or(s.status IN ('active', 'trialing', 'past_due')), false) AS paying,
      coalesce(bool_or(s.status = 'trialing'), false) AS trialing,
      coalesce(bool_or(s.status = 'past_due'), false) AS past_due,
      min(s.created_at) AS first_sub_at,
      max(s.updated_at) FILTER (WHERE s.status = 'canceled') AS canceled_at
    FROM members m
    LEFT JOIN subscriptions s ON s.user_id = m.id
    GROUP BY m.id, m.onboarded_at, m.free_access_until
  )
`;

export async function getCommunityHealth(months = 6): Promise<CommunityHealth> {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();
  const d7Iso = new Date(now.getTime() - 7 * DAY).toISOString();
  const d14Iso = new Date(now.getTime() - 14 * DAY).toISOString();
  const d30Iso = new Date(now.getTime() - 30 * DAY).toISOString();

  const [summaryRows, activityRows, nonCommunityRows, churnRows, cohortRows] =
    await Promise.all([
      db.execute(sql`
        WITH ${MEMBER_STATUS_CTE}
        SELECT
          count(*)::int AS members,
          count(*) FILTER (WHERE paying)::int AS paying,
          count(*) FILTER (WHERE trialing)::int AS trialing,
          count(*) FILTER (WHERE past_due)::int AS "pastDue",
          count(*) FILTER (WHERE NOT paying AND free_access_until > now())::int AS comp,
          count(*) FILTER (WHERE NOT paying AND canceled_at IS NOT NULL)::int AS "churnedAllTime",
          count(*) FILTER (
            WHERE NOT paying AND canceled_at >= ${d30Iso}::timestamptz
          )::int AS "churnedLast30",
          count(*) FILTER (
            WHERE first_sub_at >= ${d30Iso}::timestamptz
          )::int AS "newPayingLast30"
        FROM member_status
      `),
      db.execute(sql`
        WITH ${MEMBER_STATUS_CTE},
        paying AS (SELECT id FROM member_status WHERE paying),
        act AS (
          SELECT
            p.id,
            max(a.created_at) AS last_at,
            count(DISTINCT a.created_at::date) FILTER (
              WHERE a.created_at >= ${d7Iso}::timestamptz
            ) AS days_last7
          FROM paying p
          LEFT JOIN activity_log a ON a.user_id = p.id
          GROUP BY p.id
        )
        SELECT
          count(*) FILTER (WHERE last_at >= ${todayIso}::timestamptz)::int AS dau,
          count(*) FILTER (WHERE last_at >= ${d7Iso}::timestamptz)::int AS wau,
          count(*) FILTER (WHERE last_at >= ${d30Iso}::timestamptz)::int AS mau,
          count(*) FILTER (WHERE days_last7 >= 5)::int AS "dailyRegulars",
          count(*) FILTER (
            WHERE last_at IS NOT NULL AND last_at < ${d14Iso}::timestamptz
          )::int AS "goneQuiet14",
          count(*) FILTER (WHERE last_at IS NULL)::int AS "neverActive"
        FROM act
      `),
      db.execute(sql`
        SELECT count(*)::int AS n
        FROM subscriptions s
        JOIN users u ON u.id = s.user_id
        WHERE s.status IN ('active', 'trialing', 'past_due')
          AND (u.onboarded_at IS NULL OR u.role <> 'member')
      `),
      db.execute(sql`
        WITH ${MEMBER_STATUS_CTE},
        months AS (
          SELECT generate_series(
            date_trunc('month', now()) - make_interval(months => ${months - 1}::int),
            date_trunc('month', now()),
            interval '1 month'
          ) AS ms
        )
        SELECT
          to_char(mo.ms, 'YYYY-MM') AS month,
          count(*) FILTER (
            WHERE ms_.first_sub_at < mo.ms
              AND (ms_.paying OR ms_.canceled_at IS NULL OR ms_.canceled_at >= mo.ms)
          )::int AS "startPaying",
          count(*) FILTER (
            WHERE ms_.first_sub_at >= mo.ms
              AND ms_.first_sub_at < mo.ms + interval '1 month'
          )::int AS joined,
          count(*) FILTER (
            WHERE NOT ms_.paying
              AND ms_.canceled_at >= mo.ms
              AND ms_.canceled_at < mo.ms + interval '1 month'
          )::int AS churned
        FROM months mo
        CROSS JOIN member_status ms_
        WHERE ms_.first_sub_at IS NOT NULL
        GROUP BY mo.ms
        ORDER BY mo.ms DESC
      `),
      db.execute(sql`
        WITH ${MEMBER_STATUS_CTE},
        recent AS (
          SELECT DISTINCT user_id FROM activity_log
          WHERE created_at >= ${d30Iso}::timestamptz
        )
        SELECT
          to_char(date_trunc('month', ms_.onboarded_at), 'YYYY-MM') AS month,
          count(*)::int AS joined,
          count(*) FILTER (WHERE ms_.paying)::int AS "stillPaying",
          count(r.user_id)::int AS "activeLast30"
        FROM member_status ms_
        LEFT JOIN recent r ON r.user_id = ms_.id
        WHERE ms_.onboarded_at >= date_trunc('month', now()) - make_interval(months => ${months - 1}::int)
        GROUP BY 1
        ORDER BY 1 DESC
      `),
    ]);

  type Row = Record<string, unknown>;
  const s = (summaryRows as unknown as Row[])[0] ?? {};
  const a = (activityRows as unknown as Row[])[0] ?? {};
  const n = (r: Row, k: string) => Number(r[k] ?? 0);

  const paying = n(s, "paying");
  const trialing = n(s, "trialing");
  const churnedLast30 = n(s, "churnedLast30");
  const newPayingLast30 = n(s, "newPayingLast30");

  return {
    members: n(s, "members"),
    paying,
    trialing,
    pastDue: n(s, "pastDue"),
    comp: n(s, "comp"),
    churnedAllTime: n(s, "churnedAllTime"),
    churnedLast30,
    churnRate30Pct: pct(churnedLast30, paying + churnedLast30),
    newPayingLast30,
    netChangeLast30: newPayingLast30 - churnedLast30,
    dau: n(a, "dau"),
    wau: n(a, "wau"),
    mau: n(a, "mau"),
    dailyRegulars: n(a, "dailyRegulars"),
    goneQuiet14: n(a, "goneQuiet14"),
    neverActive: n(a, "neverActive"),
    estMrrUsd: Math.round((paying - trialing) * PRICE_USD),
    pricePerMemberUsd: PRICE_USD,
    nonCommunitySubs: n((nonCommunityRows as unknown as Row[])[0] ?? {}, "n"),
    churnByMonth: (churnRows as unknown as Row[]).map((r) => ({
      month: String(r.month),
      startPaying: n(r, "startPaying"),
      joined: n(r, "joined"),
      churned: n(r, "churned"),
      churnPct: pct(n(r, "churned"), n(r, "startPaying")),
    })),
    cohorts: (cohortRows as unknown as Row[]).map((r) => ({
      month: String(r.month),
      joined: n(r, "joined"),
      stillPaying: n(r, "stillPaying"),
      stillPayingPct: pct(n(r, "stillPaying"), n(r, "joined")),
      activeLast30: n(r, "activeLast30"),
      activeLast30Pct: pct(n(r, "activeLast30"), n(r, "joined")),
    })),
  };
}

/** Paying community members active on each of the last `days` days. */
export async function getDailyActiveMembers(days = 30): Promise<ActivityByDay[]> {
  const since = new Date(Date.now() - days * DAY).toISOString();
  const rows = await db.execute(sql`
    WITH ${MEMBER_STATUS_CTE}
    SELECT a.created_at::date::text AS day, count(DISTINCT a.user_id)::int AS count
    FROM activity_log a
    JOIN member_status ms_ ON ms_.id = a.user_id AND ms_.paying
    WHERE a.created_at >= ${since}::timestamptz
    GROUP BY 1
  `);
  const byDay = new Map<string, number>();
  for (const r of rows as unknown as { day: string; count: number }[]) {
    byDay.set(String(r.day), Number(r.count));
  }
  const out: ActivityByDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = isoDate(new Date(Date.now() - i * DAY));
    out.push({ date: key, count: byDay.get(key) ?? 0 });
  }
  return out;
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
