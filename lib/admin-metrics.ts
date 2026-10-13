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

// ── Date range ───────────────────────────────────────────────────────────────
//
// The dashboard date picker. Either a preset ("last N days, including today")
// or a custom from/to (both inclusive, YYYY-MM-DD, UTC). `to` is stored as an
// exclusive bound: midnight UTC after the last included day.

export const RANGE_PRESETS = [
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "90d", label: "90 days", days: 90 },
  { value: "180d", label: "6 months", days: 180 },
  { value: "365d", label: "12 months", days: 365 },
] as const;

const MAX_RANGE_DAYS = 730;

export type DateRange = {
  preset: string | null;   // preset value, or null for a custom range
  from: Date;              // inclusive
  to: Date;                // exclusive
  fromInput: string;       // YYYY-MM-DD, for the date inputs
  toInput: string;         // YYYY-MM-DD (inclusive last day)
  days: number;
  label: string;
};

function utcMidnight(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseDay(v: string | undefined): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseDateRange(params: {
  range?: string;
  from?: string;
  to?: string;
}): DateRange {
  const tomorrow = new Date(utcMidnight(new Date()).getTime() + DAY);
  let from: Date;
  let to: Date;
  let preset: string | null = null;

  const customFrom = parseDay(params.from);
  const customTo = parseDay(params.to);
  if (params.range === "custom" && (customFrom || customTo)) {
    let a = customFrom ?? new Date((customTo ?? tomorrow).getTime() - 29 * DAY);
    let b = customTo ?? new Date(tomorrow.getTime() - DAY);
    if (a > b) [a, b] = [b, a];
    to = new Date(Math.min(b.getTime() + DAY, tomorrow.getTime()));
    from = new Date(Math.max(a.getTime(), to.getTime() - MAX_RANGE_DAYS * DAY));
    if (from >= to) from = new Date(to.getTime() - DAY);
  } else {
    const p = RANGE_PRESETS.find((x) => x.value === params.range) ?? RANGE_PRESETS[1];
    preset = p.value;
    to = tomorrow;
    from = new Date(to.getTime() - p.days * DAY);
  }

  const days = Math.round((to.getTime() - from.getTime()) / DAY);
  const fromInput = isoDate(from);
  const toInput = isoDate(new Date(to.getTime() - DAY));
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const label = preset
    ? `Last ${RANGE_PRESETS.find((x) => x.value === preset)!.label}`
    : `${fmt(from)} – ${fmt(new Date(to.getTime() - DAY))}`;
  return { preset, from, to, fromInput, toInput, days, label };
}

export function defaultDateRange(): DateRange {
  return parseDateRange({});
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
  // ── Selected date range ──
  payingAtStart: number;          // paying when the range began
  churnedInRange: number;         // canceled during the range
  churnRatePct: number | null;    // churnedInRange / (payingAtStart + newPayingInRange)
  newPayingInRange: number;       // first subscription during the range
  netChangeInRange: number;
  activeInRange: number;          // members (any status) who used the app in the range
  activePayingInRange: number;    // … of whom are paying now
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

// ── Participation segments ───────────────────────────────────────────────────
//
// Every community member falls into exactly one participation bucket, based on
// how many different days they did something in the app (activity_log):
//   never    — zero activity, ever
//   light    — used it, but on fewer than ENGAGED_DAYS days in their first 30
//              days after onboarding
//   engaged  — active on ENGAGED_DAYS+ different days in their first 30 days
// The first-30-days window keeps the comparison fair: a member who has been
// around for a year would otherwise look "engaged" just by tenure, and someone
// who canceled in week two never had the chance to rack up days.
//
// The dashboard toggle filters every community-health number by segment:
//   all          — every member
//   participated — light + engaged (did at least one thing in the app)
//   engaged      — engaged only
//   never        — never used the app

export const ENGAGED_DAYS = 4;

export const MEMBER_SEGMENTS = ["all", "participated", "engaged", "never"] as const;
export type MemberSegment = (typeof MEMBER_SEGMENTS)[number];

export function parseSegment(v: string | undefined): MemberSegment {
  return (MEMBER_SEGMENTS as readonly string[]).includes(v ?? "")
    ? (v as MemberSegment)
    : "all";
}

const SEGMENT_FILTER: Record<MemberSegment, string> = {
  all: "true",
  participated: "bucket IN ('light', 'engaged')",
  engaged: "bucket = 'engaged'",
  never: "bucket = 'never'",
};

// Per-member rollup reused by every community-health query, filtered to one
// participation segment.
function memberStatusCte(segment: MemberSegment) {
  return sql`
  member_activity AS (
    SELECT
      u.id,
      u.onboarded_at,
      u.free_access_until,
      CASE
        WHEN count(a.id) = 0 THEN 'never'
        WHEN count(DISTINCT a.created_at::date) FILTER (
          WHERE a.created_at < u.onboarded_at + interval '30 days'
        ) >= ${sql.raw(String(ENGAGED_DAYS))} THEN 'engaged'
        ELSE 'light'
      END AS bucket
    FROM users u
    LEFT JOIN activity_log a ON a.user_id = u.id
    WHERE u.onboarded_at IS NOT NULL
      AND u.role = 'member'
    GROUP BY u.id, u.onboarded_at, u.free_access_until
  ),
  members AS (
    SELECT id, onboarded_at, free_access_until, bucket
    FROM member_activity
    WHERE ${sql.raw(SEGMENT_FILTER[segment])}
  ),
  member_status AS (
    SELECT
      m.id,
      m.onboarded_at,
      m.free_access_until,
      m.bucket,
      coalesce(bool_or(s.status IN ('active', 'trialing', 'past_due')), false) AS paying,
      coalesce(bool_or(s.status = 'trialing'), false) AS trialing,
      coalesce(bool_or(s.status = 'past_due'), false) AS past_due,
      min(s.created_at) AS first_sub_at,
      max(s.updated_at) FILTER (WHERE s.status = 'canceled') AS canceled_at
    FROM members m
    LEFT JOIN subscriptions s ON s.user_id = m.id
    GROUP BY m.id, m.onboarded_at, m.free_access_until, m.bucket
  )
`;
}

export async function getCommunityHealth(
  range: DateRange = defaultDateRange(),
  segment: MemberSegment = "all",
): Promise<CommunityHealth> {
  const MEMBER_STATUS_CTE = memberStatusCte(segment);
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();
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
            WHERE first_sub_at < ${fromIso}::timestamptz
              AND (paying OR canceled_at IS NULL OR canceled_at >= ${fromIso}::timestamptz)
          )::int AS "payingAtStart",
          count(*) FILTER (
            WHERE NOT paying
              AND canceled_at >= ${fromIso}::timestamptz
              AND canceled_at < ${toIso}::timestamptz
          )::int AS "churnedInRange",
          count(*) FILTER (
            WHERE first_sub_at >= ${fromIso}::timestamptz
              AND first_sub_at < ${toIso}::timestamptz
          )::int AS "newPayingInRange",
          count(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM activity_log a
            WHERE a.user_id = member_status.id
              AND a.created_at >= ${fromIso}::timestamptz
              AND a.created_at < ${toIso}::timestamptz
          ))::int AS "activeInRange",
          count(*) FILTER (WHERE paying AND EXISTS (
            SELECT 1 FROM activity_log a
            WHERE a.user_id = member_status.id
              AND a.created_at >= ${fromIso}::timestamptz
              AND a.created_at < ${toIso}::timestamptz
          ))::int AS "activePayingInRange"
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
            date_trunc('month', ${fromIso}::timestamptz),
            date_trunc('month', ${toIso}::timestamptz - interval '1 second'),
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
        WHERE ms_.onboarded_at >= ${fromIso}::timestamptz
          AND ms_.onboarded_at < ${toIso}::timestamptz
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
  const payingAtStart = n(s, "payingAtStart");
  const churnedInRange = n(s, "churnedInRange");
  const newPayingInRange = n(s, "newPayingInRange");

  return {
    members: n(s, "members"),
    paying,
    trialing,
    pastDue: n(s, "pastDue"),
    comp: n(s, "comp"),
    churnedAllTime: n(s, "churnedAllTime"),
    payingAtStart,
    churnedInRange,
    churnRatePct: pct(churnedInRange, payingAtStart + newPayingInRange),
    newPayingInRange,
    netChangeInRange: newPayingInRange - churnedInRange,
    activeInRange: n(s, "activeInRange"),
    activePayingInRange: n(s, "activePayingInRange"),
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
      churnPct: pct(n(r, "churned"), n(r, "startPaying") + n(r, "joined")),
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

export type SegmentChurn = {
  bucket: "never" | "light" | "engaged" | "participated";
  members: number;
  paying: number;
  churnedAllTime: number;
  payingAtStart: number;         // paying when the range began
  newPayingInRange: number;      // started paying during the range
  churnedInRange: number;
  stillHerePct: number | null;   // paying / (paying + churnedAllTime)
  churnRatePct: number | null;   // churnedInRange / (payingAtStart + newPayingInRange)
};

/**
 * Churn side by side for each participation bucket, so you can see whether
 * members who actually use the app cancel less than those who don't.
 * Returned as never, light, engaged, plus participated (light + engaged).
 */
export async function getChurnBySegment(
  range: DateRange = defaultDateRange(),
): Promise<SegmentChurn[]> {
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();
  const rows = await db.execute(sql`
    WITH ${memberStatusCte("all")}
    SELECT
      bucket,
      count(*)::int AS members,
      count(*) FILTER (WHERE paying)::int AS paying,
      count(*) FILTER (WHERE NOT paying AND canceled_at IS NOT NULL)::int AS "churnedAllTime",
      count(*) FILTER (
        WHERE first_sub_at < ${fromIso}::timestamptz
          AND (paying OR canceled_at IS NULL OR canceled_at >= ${fromIso}::timestamptz)
      )::int AS "payingAtStart",
      count(*) FILTER (
        WHERE first_sub_at >= ${fromIso}::timestamptz
          AND first_sub_at < ${toIso}::timestamptz
      )::int AS "newPayingInRange",
      count(*) FILTER (
        WHERE NOT paying
          AND canceled_at >= ${fromIso}::timestamptz
          AND canceled_at < ${toIso}::timestamptz
      )::int AS "churnedInRange"
    FROM member_status
    GROUP BY bucket
  `);

  type Counts = Pick<
    SegmentChurn,
    "members" | "paying" | "churnedAllTime" | "payingAtStart" | "newPayingInRange" | "churnedInRange"
  >;
  const zero: Counts = {
    members: 0,
    paying: 0,
    churnedAllTime: 0,
    payingAtStart: 0,
    newPayingInRange: 0,
    churnedInRange: 0,
  };
  const byBucket = new Map<string, Counts>();
  for (const r of rows as unknown as Record<string, unknown>[]) {
    byBucket.set(String(r.bucket), {
      members: Number(r.members ?? 0),
      paying: Number(r.paying ?? 0),
      churnedAllTime: Number(r.churnedAllTime ?? 0),
      payingAtStart: Number(r.payingAtStart ?? 0),
      newPayingInRange: Number(r.newPayingInRange ?? 0),
      churnedInRange: Number(r.churnedInRange ?? 0),
    });
  }
  const light = byBucket.get("light") ?? zero;
  const engaged = byBucket.get("engaged") ?? zero;
  const participated: Counts = {
    members: light.members + engaged.members,
    paying: light.paying + engaged.paying,
    churnedAllTime: light.churnedAllTime + engaged.churnedAllTime,
    payingAtStart: light.payingAtStart + engaged.payingAtStart,
    newPayingInRange: light.newPayingInRange + engaged.newPayingInRange,
    churnedInRange: light.churnedInRange + engaged.churnedInRange,
  };

  const finish = (bucket: SegmentChurn["bucket"], c: Counts): SegmentChurn => ({
    bucket,
    ...c,
    stillHerePct: pct(c.paying, c.paying + c.churnedAllTime),
    churnRatePct: pct(c.churnedInRange, c.payingAtStart + c.newPayingInRange),
  });
  return [
    finish("never", byBucket.get("never") ?? zero),
    finish("light", light),
    finish("engaged", engaged),
    finish("participated", participated),
  ];
}

/** Community members (in the segment) active on each day of the range. */
export async function getDailyActiveMembers(
  range: DateRange = defaultDateRange(),
  segment: MemberSegment = "all",
): Promise<ActivityByDay[]> {
  const since = range.from.toISOString();
  const until = range.to.toISOString();
  const rows = await db.execute(sql`
    WITH ${memberStatusCte(segment)}
    SELECT (a.created_at AT TIME ZONE 'UTC')::date::text AS day,
           count(DISTINCT a.user_id)::int AS count
    FROM activity_log a
    JOIN member_status ms_ ON ms_.id = a.user_id
    WHERE a.created_at >= ${since}::timestamptz
      AND a.created_at < ${until}::timestamptz
    GROUP BY 1
  `);
  const byDay = new Map<string, number>();
  for (const r of rows as unknown as { day: string; count: number }[]) {
    byDay.set(String(r.day), Number(r.count));
  }
  const out: ActivityByDay[] = [];
  for (let t = range.from.getTime(); t < range.to.getTime(); t += DAY) {
    const key = isoDate(new Date(t));
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

export async function getActivityBreakdown(
  daysOrRange: number | DateRange = 30,
): Promise<ActivityBreakdown[]> {
  const where =
    typeof daysOrRange === "number"
      ? gte(activityLog.createdAt, new Date(Date.now() - daysOrRange * DAY))
      : and(
          gte(activityLog.createdAt, daysOrRange.from),
          lt(activityLog.createdAt, daysOrRange.to),
        );
  const rows = await db
    .select({
      type: activityLog.type,
      count: sql<number>`count(*)::int`,
    })
    .from(activityLog)
    .where(where)
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
