import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db, users, progressEntries, streaks, activityLog, workouts } from "@/lib/db";
import { eq, desc, and } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Trophy, TrendingDown, Flame, LineChart, Sparkles, Dumbbell, Clock, ChevronRight, Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { NewEntryForm } from "./new-entry-form";
import { formatDate } from "@/lib/utils";
import { computeProgressInsights } from "@/lib/insights";
import {
  WeightSparkline,
  WeeklyConsistencyBars,
  ActivityHeatmap,
} from "@/components/progress/charts";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) redirect("/onboarding");

  const entries = await db
    .select()
    .from(progressEntries)
    .where(eq(progressEntries.userId, me.id))
    .orderBy(desc(progressEntries.entryDate))
    .limit(30);

  const [streak] = await db.select().from(streaks).where(eq(streaks.userId, me.id)).limit(1);
  const insights = await computeProgressInsights(me.id);

  const workoutHistory = await db
    .select({
      logId: activityLog.id,
      loggedAt: activityLog.createdAt,
      workoutId: workouts.id,
      title: workouts.title,
      slug: workouts.slug,
      durationMin: workouts.durationMin,
      intensity: workouts.intensity,
    })
    .from(activityLog)
    .innerJoin(workouts, eq(activityLog.referenceId, workouts.id))
    .where(and(eq(activityLog.userId, me.id), eq(activityLog.type, "workout_completed")))
    .orderBy(desc(activityLog.createdAt))
    .limit(50)
    .catch(() => []);

  // Headline lb-lost = first - latest, clamped at 0 so we never tell someone they "gained".
  const lostLb = Math.max(0, -insights.weightDeltaLb);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-10 md:py-8">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="size-3" /> Private — only you see what's on this page
      </div>
      <h1 className="font-display text-4xl font-bold">Your progress</h1>

      {/* Top stat cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Card className="p-5">
          <TrendingDown className="size-5 text-primary" />
          <div className="mt-2 font-display text-3xl font-bold">{lostLb.toFixed(1)} lb</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">lost</div>
        </Card>
        <Card className="p-5">
          <Flame className="size-5 text-primary" />
          <div className="mt-2 font-display text-3xl font-bold">{streak?.current ?? 0}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">day streak</div>
        </Card>
        <Card className="p-5">
          <Dumbbell className="size-5 text-primary" />
          <div className="mt-2 font-display text-3xl font-bold">{workoutHistory.length === 50 ? "50+" : workoutHistory.length}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">workouts done</div>
        </Card>
        <Card className="p-5">
          <Trophy className="size-5 text-primary" />
          <div className="mt-2 font-display text-3xl font-bold">{insights.entryCount}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">check-ins</div>
        </Card>
      </div>

      {/* Insights */}
      <section className="mt-8 space-y-5">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-2xl font-bold">Insights</h2>
          <Sparkles className="size-4 text-primary" />
        </div>

        {/* Weight trend — unlocks at 3 entries */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <LineChart className="size-4 text-primary" /> Weight trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insights.unlocks.trendGraph ? (
              <>
                <WeightSparkline points={insights.weightSeries} />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="text-muted-foreground">
                    {insights.weightSeries.length} check-ins ·{" "}
                    {formatDate(insights.weightSeries[0].date, { month: "short", day: "numeric" })} →{" "}
                    {formatDate(
                      insights.weightSeries[insights.weightSeries.length - 1].date,
                      { month: "short", day: "numeric" }
                    )}
                  </div>
                  <div
                    className={
                      insights.weightDeltaLb < 0
                        ? "font-bold text-primary"
                        : insights.weightDeltaLb > 0
                          ? "font-semibold text-amber-700"
                          : "font-semibold text-muted-foreground"
                    }
                  >
                    {insights.weightDeltaLb < 0
                      ? `↓ ${Math.abs(insights.weightDeltaLb).toFixed(1)} lb total`
                      : insights.weightDeltaLb > 0
                        ? `↑ ${insights.weightDeltaLb.toFixed(1)} lb`
                        : "Holding steady"}
                  </div>
                </div>
              </>
            ) : (
              <UnlockNudge
                done={insights.weightSeries.length}
                target={3}
                label="weight check-ins"
                cta="Log your weight 3 times — even a week apart — and your trend graph unlocks."
              />
            )}
          </CardContent>
        </Card>

        {/* Consistency bars — unlocks at 7 workouts in last 30 days */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Workout consistency · last 12 weeks</CardTitle>
          </CardHeader>
          <CardContent>
            {insights.unlocks.consistencyChart ? (
              <>
                <WeeklyConsistencyBars bars={insights.weeklyBars} />
                <p className="mt-3 text-sm text-muted-foreground">
                  Last 30 days:{" "}
                  <span className="font-bold text-foreground">
                    {insights.workoutsLast30PerWeek}
                  </span>{" "}
                  workouts per week.{" "}
                  <ConsistencyMessage
                    perWeek={insights.workoutsLast30PerWeek}
                    tier={insights.consistencyTier}
                  />
                </p>
              </>
            ) : (
              <UnlockNudge
                done={insights.workoutsLast30}
                target={7}
                label="workouts in the last 30 days"
                cta="Hoop 7 days in a month and your consistency chart unlocks — you'll see your weekly pattern at a glance."
              />
            )}
          </CardContent>
        </Card>

        {/* Activity heatmap — always visible (looks great even on day 1) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Activity · last 90 days</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityHeatmap cells={insights.heatmap} />
          </CardContent>
        </Card>

        {/* Community comparison — only shown when both unlock */}
        {insights.unlocks.insightsCompare && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="size-4 text-primary" /> Personal insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <CommunityStats perWeek={insights.workoutsLast30PerWeek} />
            </CardContent>
          </Card>
        )}
      </section>

      {/* Photo journal */}
      {(() => {
        const photoEntries = entries.filter((e) => e.photoUrls.length > 0);
        const first = photoEntries.at(-1); // oldest
        const latest = photoEntries.at(0);  // newest
        const hasComparison = first && latest && first.id !== latest.id;

        return (
          <section className="mt-8">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl font-bold">Photo journal</h2>
              <Camera className="size-5 text-primary" />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">Private — only visible to you.</p>

            {photoEntries.length === 0 ? (
              <Card className="mt-4 border-dashed">
                <CardContent className="py-10 text-center">
                  <Camera className="mx-auto size-10 text-muted-foreground/40" />
                  <p className="mt-3 font-semibold">No photos yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add a photo to today's check-in below to start your visual timeline.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="mt-4 space-y-5">
                {/* Before / Now comparison */}
                {hasComparison && (
                  <Card>
                    <CardContent className="p-4">
                      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Your transformation
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="overflow-hidden rounded-xl aspect-[3/4] bg-muted">
                            <img
                              src={first.photoUrls[0]}
                              alt="First check-in"
                              className="size-full object-cover"
                            />
                          </div>
                          <p className="mt-1.5 text-center text-xs text-muted-foreground">
                            {formatDate(String(first.entryDate), { month: "short", day: "numeric" })}
                          </p>
                        </div>
                        <div>
                          <div className="overflow-hidden rounded-xl aspect-[3/4] bg-muted">
                            <img
                              src={latest.photoUrls[0]}
                              alt="Latest check-in"
                              className="size-full object-cover"
                            />
                          </div>
                          <p className="mt-1.5 text-center text-xs font-semibold text-primary">
                            Now
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Full grid */}
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {photoEntries.map((e) =>
                    e.photoUrls.map((url, i) => (
                      <div key={`${e.id}-${i}`} className="group relative">
                        <div className="overflow-hidden rounded-xl aspect-square bg-muted">
                          <img
                            src={url}
                            alt=""
                            className="size-full object-cover transition-transform group-hover:scale-105"
                          />
                        </div>
                        {i === 0 && (
                          <p className="mt-1 text-center text-[10px] text-muted-foreground">
                            {formatDate(String(e.entryDate), { month: "short", day: "numeric" })}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>
        );
      })()}

      {/* New entry form */}
      <div className="mt-8">
        <NewEntryForm />
      </div>

      {/* Workout history */}
      <div className="mt-8">
        <h2 className="font-display text-2xl font-bold">Workout history</h2>
        {workoutHistory.length === 0 ? (
          <Card className="mt-4">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Complete your first workout to see it here.
            </CardContent>
          </Card>
        ) : (
          <div className="mt-4 divide-y rounded-xl border">
            {workoutHistory.map((w) => (
              <Link
                key={w.logId}
                href={`/workouts/${w.slug}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Dumbbell className="size-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{w.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(w.loggedAt).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <Clock className="mr-1 size-3" />
                    {w.durationMin}m
                  </Badge>
                  <Badge variant="outline" className="capitalize text-xs">{w.intensity}</Badge>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="mt-8">
        <h2 className="font-display text-2xl font-bold">Timeline</h2>
        <div className="mt-4 space-y-3">
          {entries.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Log your first entry above to start tracking.
              </CardContent>
            </Card>
          ) : (
            entries.map((e) => (
              <Card key={e.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="size-14 shrink-0 rounded-xl bg-muted">
                    {e.photoUrls[0] && (
                      <img src={e.photoUrls[0]} className="size-full rounded-xl object-cover" alt="" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{formatDate(String(e.entryDate))}</div>
                    <div className="flex gap-3 text-sm text-muted-foreground">
                      {e.weightLb && <span>{e.weightLb} lb</span>}
                      {e.mood && <span>Mood: {e.mood}/5</span>}
                      {e.energyLevel && <span>Energy: {e.energyLevel}/5</span>}
                    </div>
                    {e.note && <p className="mt-1 text-sm">{e.note}</p>}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Locked-state encouragement card ────────────────────────────────
function UnlockNudge({
  done,
  target,
  label,
  cta,
}: {
  done: number;
  target: number;
  label: string;
  cta: string;
}) {
  const remaining = Math.max(0, target - done);
  const pct = Math.min(100, Math.round((done / target) * 100));
  return (
    <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Lock className="size-4 text-primary" />
        <p className="text-sm font-semibold">
          {remaining > 0
            ? `${remaining} more to unlock`
            : `Almost there — log one more`}
        </p>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{cta}</p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-primary/15">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {done} / {target} {label}
      </p>
    </div>
  );
}

// ── Inline copy helpers ────────────────────────────────────────────
function ConsistencyMessage({
  perWeek,
  tier,
}: {
  perWeek: number;
  tier: "starting" | "building" | "consistent" | "champion";
}) {
  switch (tier) {
    case "champion":
      return <>That's elite — top 5% of members. Keep that body in motion 🔥</>;
    case "consistent":
      return (
        <>
          That's the sweet spot. Members hitting <strong>3+ days/week</strong>{" "}
          typically lose an extra inch from their waist per month vs. those who don't.
        </>
      );
    case "building":
      return (
        <>
          You're building a habit — push to <strong>3 days/week</strong> and you'll start
          seeing your waistline change faster.
        </>
      );
    default:
      return (
        <>
          Aim for <strong>3 hooping days this week</strong> — that's the threshold where
          most members start seeing inches drop.
        </>
      );
  }
}

function CommunityStats({ perWeek }: { perWeek: number }) {
  const items: { stat: string; body: string }[] = [];

  if (perWeek >= 3) {
    items.push({
      stat: "🎯 You're in the consistent zone",
      body: "Members hooping 3+ days per week typically lose an extra inch from their waist per month versus those who hoop less.",
    });
  } else {
    items.push({
      stat: "🪄 Three days is the magic number",
      body: "Members hooping 3+ days per week typically lose an extra inch from their waist per month — you're one solid week away from that group.",
    });
  }

  items.push({
    stat: "📅 Day 21 is the shift",
    body: "Most members say they felt their abs change more around day 21 than the scale did. Trust the process.",
  });

  items.push({
    stat: "💪 Consistency beats intensity",
    body: "A 15-min hoop daily outperforms a 60-min hoop on the weekend. Short and steady wins.",
  });

  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.stat}>
          <p className="font-semibold">{it.stat}</p>
          <p className="text-muted-foreground">{it.body}</p>
        </li>
      ))}
    </ul>
  );
}
