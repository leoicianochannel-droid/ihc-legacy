import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  TrendingUp,
  Trophy,
  Star,
  CheckCircle2,
  Flame,
  BarChart3,
  MessageSquare,
  ThumbsUp,
  FlaskConical,
} from "lucide-react";
import { getChallengeAnalytics, type ChallengeAnalytics } from "@/lib/challenge-analytics";
import { BarSeries, HorizontalBars } from "@/components/admin/charts";
import Link from "next/link";

export const dynamic = "force-dynamic";

// Realistic sample data for the preview/loom mode
const DEMO_DATA: ChallengeAnalytics = {
  challenge: {
    id: "demo",
    title: "30-Day Hoop Challenge",
    startsAt: new Date("2026-07-01"),
    endsAt: new Date("2026-07-30"),
    durationDays: 30,
  },
  totalUnits: 30,
  total: 312,
  completed: 8,
  activeThisWeek: 204,
  contestEnrolled: 67,
  joinsByDay: [
    { date: "2026-07-01", count: 94 },
    { date: "2026-07-02", count: 58 },
    { date: "2026-07-03", count: 41 },
    { date: "2026-07-04", count: 29 },
    { date: "2026-07-05", count: 22 },
    { date: "2026-07-06", count: 18 },
    { date: "2026-07-07", count: 14 },
    { date: "2026-07-08", count: 11 },
    { date: "2026-07-09", count: 9 },
    { date: "2026-07-10", count: 8 },
    { date: "2026-07-11", count: 8 },
  ],
  checkinsByDay: [
    { dayNumber: 1, count: 278 },
    { dayNumber: 2, count: 251 },
    { dayNumber: 3, count: 239 },
    { dayNumber: 4, count: 224 },
    { dayNumber: 5, count: 213 },
    { dayNumber: 6, count: 198 },
    { dayNumber: 7, count: 189 },
    { dayNumber: 8, count: 171 },
    { dayNumber: 9, count: 163 },
    { dayNumber: 10, count: 154 },
  ],
  moodByDay: [
    { dayNumber: 1, avgMood: 4.6, moodCount: 112 },
    { dayNumber: 2, avgMood: 4.4, moodCount: 98 },
    { dayNumber: 3, avgMood: 4.2, moodCount: 91 },
    { dayNumber: 4, avgMood: 3.9, moodCount: 84 },
    { dayNumber: 5, avgMood: 3.8, moodCount: 79 },
    { dayNumber: 6, avgMood: 4.0, moodCount: 74 },
    { dayNumber: 7, avgMood: 4.3, moodCount: 71 },
    { dayNumber: 8, avgMood: 4.1, moodCount: 63 },
    { dayNumber: 9, avgMood: 4.2, moodCount: 58 },
    { dayNumber: 10, avgMood: 4.4, moodCount: 54 },
  ],
  feedback: {
    total: 8,
    avgRating: 4.6,
    wouldRecommend: 7,
    willReview: 5,
  },
  recentFeedback: [
    {
      rating: 5,
      favoritePart: "The daily structure kept me accountable in a way I haven't felt before. I actually looked forward to checking in every day.",
      improvement: "More recipe ideas would be amazing!",
      submittedAt: new Date("2026-07-10"),
    },
    {
      rating: 5,
      favoritePart: "I lost 2 inches off my waist and didn't even realize it was happening. The community kept me going.",
      improvement: null,
      submittedAt: new Date("2026-07-10"),
    },
    {
      rating: 4,
      favoritePart: "Loved the variety of workouts — never felt repetitive. My kids even started joining me!",
      improvement: "Would love a beginner modification option for some moves.",
      submittedAt: new Date("2026-07-09"),
    },
    {
      rating: 5,
      favoritePart: "The hashtag challenge made it feel real. Seeing other people post kept me motivated.",
      improvement: null,
      submittedAt: new Date("2026-07-09"),
    },
    {
      rating: 4,
      favoritePart: "I'm sleeping better, my energy is up, and I actually want to hoop every day now.",
      improvement: "A little more guidance on the contest entries would help.",
      submittedAt: new Date("2026-07-08"),
    },
  ],
  contestBreakdown: [
    { entryType: "reel", count: 38 },
    { entryType: "measurement", count: 61 },
    { entryType: "nsv", count: 24 },
    { entryType: "transformation", count: 9 },
  ],
  currentDayDist: [
    { currentDay: 8, count: 41 },
    { currentDay: 9, count: 78 },
    { currentDay: 10, count: 67 },
    { currentDay: 11, count: 52 },
  ],
};

const ENTRY_TYPE_LABELS: Record<string, string> = {
  reel: "Reels posted",
  measurement: "Waist check-ins",
  nsv: "Non-scale victories",
  transformation: "Transformation stories",
};

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: typeof Users;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-primary/30 bg-primary/5" : ""}>
      <CardContent className="flex items-start justify-between gap-3 pt-5">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-bold">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div
          className={`rounded-xl p-2.5 ${accent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`size-4 ${i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted"}`}
        />
      ))}
    </div>
  );
}

export default async function ChallengeAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  const isPreview = preview === "1";

  const data = isPreview ? DEMO_DATA : await getChallengeAnalytics("30-day-challenge");

  if (!data) {
    return (
      <div className="container py-8">
        <p className="text-muted-foreground">Challenge not found.</p>
      </div>
    );
  }

  const {
    challenge,
    totalUnits,
    total,
    completed,
    activeThisWeek,
    contestEnrolled,
    checkinsByDay,
    joinsByDay,
    moodByDay,
    feedback,
    recentFeedback,
    contestBreakdown,
    currentDayDist,
  } = data;

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const contestRate =
    total > 0 ? Math.round((contestEnrolled / total) * 100) : 0;
  const recommendRate =
    feedback.total > 0
      ? Math.round((feedback.wouldRecommend / feedback.total) * 100)
      : 0;

  // Build funnel rows — normalize by total participants
  const funnelRows = checkinsByDay.map((d) => ({
    label:
      totalUnits && totalUnits < data.challenge.durationDays
        ? `Week ${d.dayNumber}`
        : `Day ${d.dayNumber}`,
    count: d.count,
    pct: total > 0 ? Math.round((d.count / total) * 100) : 0,
  }));

  // Build join trend for BarSeries
  const joinTrend = joinsByDay.map((d) => ({
    date: d.date,
    count: d.count,
  }));

  // Where are active members now
  const progressRows = currentDayDist.map((d) => ({
    label:
      totalUnits && totalUnits < challenge.durationDays
        ? `Week ${d.currentDay}`
        : `Day ${d.currentDay}`,
    count: d.count,
  }));

  // Mood trend for BarSeries (convert dayNumber to string label)
  const moodTrend = moodByDay
    .filter((d) => d.moodCount >= 3) // only show days with enough data
    .map((d) => ({
      date:
        totalUnits && totalUnits < challenge.durationDays
          ? `Wk ${d.dayNumber}`
          : `Day ${d.dayNumber}`,
      count: Math.round(d.avgMood * 20), // scale 1-5 to 20-100 for bar height
    }));

  // Contest entry breakdown for HorizontalBars
  const contestRows = contestBreakdown.map((e) => ({
    label: ENTRY_TYPE_LABELS[e.entryType] ?? e.entryType,
    count: e.count,
  }));

  const hasMoodData = moodByDay.some((d) => d.moodCount >= 3);

  return (
    <div className="container space-y-6 py-8">
      {/* Preview banner */}
      {isPreview && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <FlaskConical className="size-4 shrink-0" />
          Preview mode — sample data only. Live data starts July 1st.
          <Link href="/admin/challenges/analytics" className="ml-auto underline underline-offset-2 opacity-70 hover:opacity-100">
            View live →
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-bold">
              Challenge Analytics
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {challenge.title} · {isPreview ? "sample data preview" : "live from the database"}
          </p>
        </div>
        <Link
          href="/admin/challenges/submissions"
          className="rounded-full border px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
        >
          View contest entries →
        </Link>
      </div>

      {/* Decision signal */}
      {total >= 10 && (
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CardContent className="pt-4">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              📊 Key signals for "do it again?"
            </p>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-emerald-700 dark:text-emerald-400">
              <span>
                <strong>{completionRate}%</strong> completion rate
              </span>
              {feedback.total > 0 && (
                <>
                  <span>
                    <strong>{feedback.avgRating}/5</strong> avg rating
                  </span>
                  <span>
                    <strong>{recommendRate}%</strong> would recommend
                  </span>
                </>
              )}
              <span>
                <strong>{contestRate}%</strong> entered the contest
              </span>
              <span>
                <strong>{activeThisWeek}</strong> active this week
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total participants"
          value={total.toLocaleString()}
          icon={Users}
          accent
        />
        <StatCard
          label="Completed"
          value={completed.toLocaleString()}
          sub={`${completionRate}% completion rate`}
          icon={CheckCircle2}
        />
        <StatCard
          label="Active this week"
          value={activeThisWeek.toLocaleString()}
          sub="had a check-in in last 7 days"
          icon={Flame}
        />
        <StatCard
          label="Contest enrolled"
          value={contestEnrolled.toLocaleString()}
          sub={`${contestRate}% of participants`}
          icon={Trophy}
        />
      </div>

      {/* Join trend */}
      {joinTrend.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="size-4 text-primary" /> New joins over time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarSeries
              data={joinTrend}
              emptyLabel="No join data yet."
              label={`${total} total participants`}
            />
          </CardContent>
        </Card>
      )}

      {/* Drop-off funnel */}
      {funnelRows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="size-4 text-primary" /> Completion funnel
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              How many participants completed each{" "}
              {totalUnits && totalUnits < challenge.durationDays
                ? "week"
                : "day"}
              . Drop-off here shows where people disengage.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {funnelRows.map((row) => (
                <li key={row.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold">{row.label}</span>
                    <span className="text-muted-foreground">
                      {row.count.toLocaleString()} · {row.pct}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Where are in-progress members */}
      {progressRows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="size-4 text-primary" /> Where members are now
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              In-progress participants only (excludes completed).
            </p>
          </CardHeader>
          <CardContent>
            <HorizontalBars
              rows={progressRows}
              emptyLabel="All participants have completed or no in-progress members."
            />
          </CardContent>
        </Card>
      )}

      {/* Mood tracking */}
      {hasMoodData && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Star className="size-4 text-primary" /> Mood by day
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Average self-reported mood (1–5) per{" "}
              {totalUnits && totalUnits < challenge.durationDays
                ? "week"
                : "day"}
              . Only days with 3+ responses shown.
            </p>
          </CardHeader>
          <CardContent>
            <BarSeries
              data={moodTrend}
              label="Mood score (scaled)"
              emptyLabel="Not enough mood data yet."
            />
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
              <span>↑ Higher = happier</span>
              <span>Bars scaled from 1–5 mood rating</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback */}
      {feedback.total > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Star className="size-4 text-primary" /> Post-challenge feedback
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl font-bold">
                  {feedback.avgRating}
                </span>
                <div>
                  <RatingStars rating={feedback.avgRating} />
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    from {feedback.total} responses
                  </p>
                </div>
              </div>
              <div className="space-y-2 border-t pt-3">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <ThumbsUp className="size-3.5 text-emerald-500" />
                    Would recommend
                  </span>
                  <span className="font-semibold">
                    {feedback.wouldRecommend} / {feedback.total} ({recommendRate}%)
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <Star className="size-3.5 text-amber-400" />
                    Said yes to Trustpilot review
                  </span>
                  <span className="font-semibold">{feedback.willReview}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {recentFeedback.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquare className="size-4 text-primary" /> What they
                  loved
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  {recentFeedback.slice(0, 5).map((fb, i) => (
                    <li key={i} className="border-b pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center gap-1 mb-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`size-3 ${s <= fb.rating ? "fill-amber-400 text-amber-400" : "text-muted"}`}
                          />
                        ))}
                      </div>
                      <p className="text-muted-foreground leading-snug">
                        "{fb.favoritePart}"
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Contest breakdown */}
      {contestEnrolled > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="size-4 text-primary" /> Contest engagement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6 text-sm">
              <span>
                <strong>{contestEnrolled}</strong> enrolled in contest
              </span>
              <span className="text-muted-foreground">
                {contestRate}% of all participants
              </span>
            </div>
            {contestRows.length > 0 && (
              <HorizontalBars
                rows={contestRows}
                emptyLabel="No contest entries yet."
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {total === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="mx-auto mb-3 size-8 opacity-40" />
            <p className="font-semibold">No participants yet</p>
            <p className="text-sm mt-1">
              Data will appear here as members join the challenge.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
