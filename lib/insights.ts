/**
 * Computes the data needed to render the Progress page insights.
 * Pure DB reads — keeps everything in one round of queries so the page
 * renders fast.
 */
import { db, progressEntries, activityLog } from "./db";
import { and, asc, eq, gte, sql } from "drizzle-orm";

export type WeightPoint = { date: string; weight: number };
export type WeeklyBar = { weekStart: string; count: number };
export type DayCell = { date: string; count: number };

export type ProgressInsights = {
  entryCount: number;
  weightSeries: WeightPoint[];      // date in YYYY-MM-DD, weight in lb
  weightDeltaLb: number;            // negative = loss
  weightFirst: number | null;
  weightLatest: number | null;
  weeklyBars: WeeklyBar[];          // last 12 weeks of workout counts (oldest → newest)
  heatmap: DayCell[];               // last 90 days of activity counts (oldest → newest)
  workoutsLast30: number;
  workoutsLast30PerWeek: number;    // average workouts per week over last 30 days
  consistencyTier: "starting" | "building" | "consistent" | "champion";
  unlocks: {
    trendGraph: boolean;             // 3+ progress entries
    consistencyChart: boolean;        // 7+ days of activity in last 30
    insightsCompare: boolean;         // both
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date) {
  // Monday-based week start
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // 0 = Mon
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day);
  return copy;
}

export async function computeProgressInsights(userId: string): Promise<ProgressInsights> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY_MS);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

  // Pull progress entries (oldest → newest) for the trend line.
  const entries = await db
    .select({
      entryDate: progressEntries.entryDate,
      weightLb: progressEntries.weightLb,
    })
    .from(progressEntries)
    .where(eq(progressEntries.userId, userId))
    .orderBy(asc(progressEntries.entryDate));

  const weightSeries: WeightPoint[] = entries
    .filter((e): e is { entryDate: string; weightLb: number } => e.weightLb != null)
    .map((e) => ({ date: String(e.entryDate), weight: e.weightLb }));

  const weightFirst = weightSeries[0]?.weight ?? null;
  const weightLatest = weightSeries[weightSeries.length - 1]?.weight ?? null;
  const weightDeltaLb =
    weightFirst != null && weightLatest != null ? weightLatest - weightFirst : 0;

  // Workout activity by day in the last 90 days (for heatmap).
  const workoutDays = await db
    .select({
      day: sql<string>`(${activityLog.createdAt})::date`,
      count: sql<number>`count(*)::int`,
    })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.userId, userId),
        eq(activityLog.type, "workout_completed"),
        gte(activityLog.createdAt, ninetyDaysAgo)
      )
    )
    .groupBy(sql`(${activityLog.createdAt})::date`);

  const dayMap = new Map<string, number>();
  for (const r of workoutDays) dayMap.set(String(r.day), Number(r.count));

  // Build a 90-day grid of cells (oldest → newest) so missing days show as 0.
  const heatmap: DayCell[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS);
    const key = isoDate(d);
    heatmap.push({ date: key, count: dayMap.get(key) ?? 0 });
  }

  // 12-week bars (group by week-start).
  const weekMap = new Map<string, number>();
  for (const cell of heatmap) {
    const ws = isoDate(startOfWeek(new Date(cell.date)));
    weekMap.set(ws, (weekMap.get(ws) ?? 0) + cell.count);
  }
  const weeklyBars: WeeklyBar[] = [];
  // Build 12 most-recent week buckets (Mon-anchored, oldest → newest)
  const recentMonday = startOfWeek(now);
  for (let i = 11; i >= 0; i--) {
    const ws = new Date(recentMonday.getTime() - i * 7 * DAY_MS);
    const key = isoDate(ws);
    weeklyBars.push({ weekStart: key, count: weekMap.get(key) ?? 0 });
  }

  const workoutsLast30 = heatmap
    .filter((c) => new Date(c.date) >= thirtyDaysAgo)
    .reduce((sum, c) => sum + c.count, 0);
  const workoutsLast30PerWeek = Math.round((workoutsLast30 / 30) * 7 * 10) / 10;

  // Consistency tiering — drives the encouragement copy.
  let consistencyTier: ProgressInsights["consistencyTier"] = "starting";
  if (workoutsLast30PerWeek >= 5) consistencyTier = "champion";
  else if (workoutsLast30PerWeek >= 3) consistencyTier = "consistent";
  else if (workoutsLast30PerWeek >= 1) consistencyTier = "building";

  return {
    entryCount: entries.length,
    weightSeries,
    weightDeltaLb,
    weightFirst,
    weightLatest,
    weeklyBars,
    heatmap,
    workoutsLast30,
    workoutsLast30PerWeek,
    consistencyTier,
    unlocks: {
      trendGraph: weightSeries.length >= 3,
      consistencyChart: workoutsLast30 >= 7,
      insightsCompare: weightSeries.length >= 3 && workoutsLast30 >= 7,
    },
  };
}
