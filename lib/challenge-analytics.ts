import { db } from "@/lib/db";
import {
  challenges,
  challengeDays,
  challengeMembers,
  challengeCheckins,
  challengeFeedback,
  contestEnrollments,
  contestEntries,
} from "@/lib/db/schema";
import { eq, and, gte, sql, isNotNull, desc } from "drizzle-orm";

export type ChallengeAnalytics = NonNullable<
  Awaited<ReturnType<typeof getChallengeAnalytics>>
>;

// Only count participants who joined on or after this date (current challenge run)
const CURRENT_RUN_START = new Date("2026-07-01T00:00:00Z");

export async function getChallengeAnalytics(slug: string) {
  const [challenge] = await db
    .select({
      id: challenges.id,
      title: challenges.title,
      startsAt: challenges.startsAt,
      endsAt: challenges.endsAt,
      durationDays: challenges.durationDays,
    })
    .from(challenges)
    .where(eq(challenges.slug, slug))
    .limit(1);

  if (!challenge) return null;

  const cid = challenge.id;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since = CURRENT_RUN_START;

  const [
    [totalUnitsRow],
    [statsRow],
    [activeRow],
    [contestRow],
    checkinsByDay,
    joinsByDay,
    moodByDay,
    [feedbackRow],
    recentFeedback,
    contestBreakdown,
    currentDayDist,
  ] = await Promise.all([
    // Total challenge units (days/weeks)
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(challengeDays)
      .where(eq(challengeDays.challengeId, cid)),

    // Core participation stats
    db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${challengeMembers.completedAt} is not null)::int`,
      })
      .from(challengeMembers)
      .where(and(eq(challengeMembers.challengeId, cid), gte(challengeMembers.startedAt, since))),

    // Active this week (checkin in last 7 days)
    db
      .select({
        n: sql<number>`count(distinct ${challengeCheckins.challengeMemberId})::int`,
      })
      .from(challengeCheckins)
      .innerJoin(
        challengeMembers,
        eq(challengeCheckins.challengeMemberId, challengeMembers.id)
      )
      .where(
        and(
          eq(challengeMembers.challengeId, cid),
          gte(challengeMembers.startedAt, since),
          gte(challengeCheckins.completedAt, sevenDaysAgo)
        )
      ),

    // Contest enrollment count
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(contestEnrollments)
      .where(and(eq(contestEnrollments.challengeId, cid), gte(contestEnrollments.enrolledAt, since))),

    // Completions per day number (funnel)
    db
      .select({
        dayNumber: challengeCheckins.dayNumber,
        count: sql<number>`count(distinct ${challengeCheckins.challengeMemberId})::int`,
      })
      .from(challengeCheckins)
      .innerJoin(
        challengeMembers,
        eq(challengeCheckins.challengeMemberId, challengeMembers.id)
      )
      .where(and(eq(challengeMembers.challengeId, cid), gte(challengeMembers.startedAt, since)))
      .groupBy(challengeCheckins.dayNumber)
      .orderBy(challengeCheckins.dayNumber),

    // Daily join trend
    db
      .select({
        date: sql<string>`date(${challengeMembers.startedAt})::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(challengeMembers)
      .where(and(eq(challengeMembers.challengeId, cid), gte(challengeMembers.startedAt, since)))
      .groupBy(sql`date(${challengeMembers.startedAt})`)
      .orderBy(sql`date(${challengeMembers.startedAt})`),

    // Average mood per day (only days with mood data)
    db
      .select({
        dayNumber: challengeCheckins.dayNumber,
        avgMood: sql<number>`round(avg(${challengeCheckins.mood})::numeric, 1)::float`,
        moodCount: sql<number>`count(${challengeCheckins.mood})::int`,
      })
      .from(challengeCheckins)
      .innerJoin(
        challengeMembers,
        eq(challengeCheckins.challengeMemberId, challengeMembers.id)
      )
      .where(
        and(
          eq(challengeMembers.challengeId, cid),
          gte(challengeMembers.startedAt, since),
          isNotNull(challengeCheckins.mood)
        )
      )
      .groupBy(challengeCheckins.dayNumber)
      .orderBy(challengeCheckins.dayNumber),

    // Feedback summary
    db
      .select({
        total: sql<number>`count(*)::int`,
        avgRating: sql<number>`round(avg(${challengeFeedback.rating})::numeric, 1)::float`,
        wouldRecommend: sql<number>`count(*) filter (where ${challengeFeedback.wouldRecommend} = true)::int`,
        willReview: sql<number>`count(*) filter (where ${challengeFeedback.willReview} = true)::int`,
      })
      .from(challengeFeedback)
      .innerJoin(
        challengeMembers,
        eq(challengeFeedback.challengeMemberId, challengeMembers.id)
      )
      .where(and(eq(challengeMembers.challengeId, cid), gte(challengeMembers.startedAt, since))),

    // Recent feedback quotes (with text)
    db
      .select({
        rating: challengeFeedback.rating,
        favoritePart: challengeFeedback.favoritePart,
        improvement: challengeFeedback.improvement,
        submittedAt: challengeFeedback.submittedAt,
      })
      .from(challengeFeedback)
      .innerJoin(
        challengeMembers,
        eq(challengeFeedback.challengeMemberId, challengeMembers.id)
      )
      .where(
        and(
          eq(challengeMembers.challengeId, cid),
          gte(challengeMembers.startedAt, since),
          isNotNull(challengeFeedback.favoritePart)
        )
      )
      .orderBy(desc(challengeFeedback.submittedAt))
      .limit(8),

    // Contest entry type breakdown
    db
      .select({
        entryType: contestEntries.entryType,
        count: sql<number>`count(*)::int`,
      })
      .from(contestEntries)
      .innerJoin(
        contestEnrollments,
        eq(contestEntries.enrollmentId, contestEnrollments.id)
      )
      .where(and(eq(contestEnrollments.challengeId, cid), gte(contestEnrollments.enrolledAt, since)))
      .groupBy(contestEntries.entryType),

    // Where are in-progress members right now
    db
      .select({
        currentDay: challengeMembers.currentDay,
        count: sql<number>`count(*)::int`,
      })
      .from(challengeMembers)
      .where(
        and(
          eq(challengeMembers.challengeId, cid),
          gte(challengeMembers.startedAt, since),
          sql`${challengeMembers.completedAt} is null`
        )
      )
      .groupBy(challengeMembers.currentDay)
      .orderBy(challengeMembers.currentDay),
  ]);

  return {
    challenge,
    totalUnits: totalUnitsRow?.n ?? 0,
    total: statsRow?.total ?? 0,
    completed: statsRow?.completed ?? 0,
    activeThisWeek: activeRow?.n ?? 0,
    contestEnrolled: contestRow?.n ?? 0,
    checkinsByDay,
    joinsByDay,
    moodByDay,
    feedback: {
      total: feedbackRow?.total ?? 0,
      avgRating: feedbackRow?.avgRating ?? 0,
      wouldRecommend: feedbackRow?.wouldRecommend ?? 0,
      willReview: feedbackRow?.willReview ?? 0,
    },
    recentFeedback,
    contestBreakdown,
    currentDayDist,
  };
}
