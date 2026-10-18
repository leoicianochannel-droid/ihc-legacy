import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { workoutHref } from "@/lib/workout-context";
import { auth } from "@clerk/nextjs/server";
import {
  db,
  users,
  challenges,
  challengeDays,
  challengeMembers,
  challengeCheckins,
  challengeResources,
  workouts,
} from "@/lib/db";
import { eq, and, asc, desc, gte, inArray, sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ChevronLeft,
  Lock,
  Check,
  Trophy,
  PlayCircle,
  FileText,
  Image as ImageIcon,
  FileType2,
  Download,
  Gift,
} from "lucide-react";
import { thumbnailUrl as cfThumbnail } from "@/lib/cloudflare-stream";
import { muxThumbnail } from "@/lib/mux";
import { joinChallenge } from "./actions";
import { ChallengeCheckinButton } from "@/components/challenge-checkin-button";
import { getHighestEarnedReward, getNextReward, CHALLENGE_REWARDS } from "@/lib/challenge-rewards";

export default async function ChallengeDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { userId: clerkId } = await auth();

  const [c] = await db.select().from(challenges).where(eq(challenges.slug, slug)).limit(1);
  if (!c) notFound();

  const days = await db
    .select()
    .from(challengeDays)
    .where(eq(challengeDays.challengeId, c.id))
    .orderBy(asc(challengeDays.dayNumber));

  const resources = await db
    .select()
    .from(challengeResources)
    .where(eq(challengeResources.challengeId, c.id))
    .orderBy(asc(challengeResources.sortOrder), asc(challengeResources.createdAt));

  // Pull the linked workout for each day so we can show thumbnails + link to playback
  const workoutIds = days.map((d) => d.workoutId).filter((id): id is string => !!id);
  const linkedWorkouts = workoutIds.length
    ? await db.select().from(workouts).where(inArray(workouts.id, workoutIds))
    : [];
  const workoutById = new Map(linkedWorkouts.map((w) => [w.id, w]));

  const [me] = clerkId
    ? await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1)
    : [null];

  const [membership] = me
    ? await db
        .select()
        .from(challengeMembers)
        .where(and(eq(challengeMembers.challengeId, c.id), eq(challengeMembers.userId, me.id)))
        .limit(1)
    : [null];

  const completed = membership
    ? await db
        .select()
        .from(challengeCheckins)
        .where(eq(challengeCheckins.challengeMemberId, membership.id))
    : [];
  const completedDays = new Set(completed.map((c) => c.dayNumber));
  const currentDay = membership?.currentDay ?? 1;

  // Live check-in feed — last 8 check-ins from the current run + today's total
  const CURRENT_RUN_START = new Date("2026-07-01T00:00:00Z");
  const recentCheckins = await db
    .select({
      completedAt: challengeCheckins.completedAt,
      dayNumber: challengeCheckins.dayNumber,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
    })
    .from(challengeCheckins)
    .innerJoin(challengeMembers, eq(challengeCheckins.challengeMemberId, challengeMembers.id))
    .innerJoin(users, eq(challengeMembers.userId, users.id))
    .where(
      and(
        eq(challengeMembers.challengeId, c.id),
        gte(challengeCheckins.completedAt, CURRENT_RUN_START)
      )
    )
    .orderBy(desc(challengeCheckins.completedAt))
    .limit(8);

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const [todayResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(challengeCheckins)
    .innerJoin(challengeMembers, eq(challengeCheckins.challengeMemberId, challengeMembers.id))
    .where(
      and(
        eq(challengeMembers.challengeId, c.id),
        gte(challengeCheckins.completedAt, todayStart)
      )
    );
  const todayCheckinsCount = todayResult?.count ?? 0;

  // Figure out the unit label for this challenge. If we have one row per day,
  // we call them "Day"; otherwise (e.g. 45-day uses 6 weekly buckets), "Week".
  const unit = days.length === c.durationDays ? "day" : "week";
  const Unit = unit === "day" ? "Day" : "Week";

  // Week-grouped layout: when a day-unit challenge cycles the same workouts across
  // 7-day blocks (e.g. 21DR: 9 unique workouts across 21 days), show week headers
  // with 3 deduplicated workout cards each instead of 21 individual day cards.
  const uniqueWorkoutIds = new Set(days.map(d => d.workoutId).filter(Boolean));
  const isWeekGrouped = unit === "day" && uniqueWorkoutIds.size > 0 && uniqueWorkoutIds.size < days.length && days.length > 6;
  const weekGroups = isWeekGrouped
    ? (() => {
        const DAYS_PER_WEEK = 7;
        const count = Math.ceil(days.length / DAYS_PER_WEEK);
        return Array.from({ length: count }, (_, weekIdx) => {
          const weekStart = weekIdx * DAYS_PER_WEEK + 1;
          const weekEnd = weekStart + DAYS_PER_WEEK - 1;
          const seen = new Set<string>();
          return {
            weekNum: weekIdx + 1,
            uniqueDays: days
              .filter(d => d.dayNumber >= weekStart && d.dayNumber <= weekEnd)
              .filter(d => {
                if (!d.workoutId || seen.has(d.workoutId)) return false;
                seen.add(d.workoutId);
                return true;
              }),
          };
        });
      })()
    : [];

  function timeAgo(date: Date): string {
    const secs = Math.floor((Date.now() - date.getTime()) / 1000);
    if (secs < 60) return "just now";
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  // For week-grouped challenges: a workout card is "done" if ANY day in the same
  // week with the same workoutId has been checked in (siblings count).
  function isWorkoutCardDone(d: typeof days[0]): boolean {
    if (!isWeekGrouped || !d.workoutId) return completedDays.has(d.dayNumber);
    const weekStart = Math.floor((d.dayNumber - 1) / 7) * 7 + 1;
    const weekEnd = weekStart + 6;
    return days.some(
      sd => sd.dayNumber >= weekStart && sd.dayNumber <= weekEnd &&
            sd.workoutId === d.workoutId && completedDays.has(sd.dayNumber)
    );
  }

  const totalCheckable = isWeekGrouped
    ? weekGroups.reduce((n, g) => n + g.uniqueDays.length, 0)
    : days.length;
  const completedCheckable = isWeekGrouped
    ? weekGroups.reduce((n, g) => n + g.uniqueDays.filter(d => isWorkoutCardDone(d)).length, 0)
    : completedDays.size;

  const earnedReward = membership ? getHighestEarnedReward(c.slug, completedCheckable) : null;
  const nextReward = membership ? getNextReward(c.slug, completedCheckable) : null;

  // Self-heal: if a member has completed every checkable card but lacks completedAt,
  // they got stuck due to an earlier bug. Retroactively mark complete. Idempotent.
  if (
    membership &&
    !membership.completedAt &&
    days.length > 0 &&
    completedCheckable >= totalCheckable
  ) {
    await db
      .update(challengeMembers)
      .set({ completedAt: new Date(), currentDay: days.length })
      .where(eq(challengeMembers.id, membership.id));
    redirect(`/challenges/${slug}/complete`);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-10 md:py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/challenges"><ChevronLeft /> All challenges</Link>
      </Button>

      <div
        className="relative overflow-hidden rounded-2xl hoop-gradient-bold"
        style={c.coverUrl ? { backgroundImage: `url(${c.coverUrl})`, backgroundSize: "cover" } : undefined}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="relative p-8 text-white md:p-12">
          <Badge variant="gold">{days.length}-{unit} challenge</Badge>
          <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">{c.title}</h1>
          {c.subtitle && <p className="mt-1 opacity-90">{c.subtitle}</p>}
          {c.description && <p className="mt-4 max-w-3xl opacity-90">{c.description}</p>}
          {c.rewardDescription && (() => {
            let prizes: Array<{ category: string; amount: number }> | null = null;
            try { prizes = JSON.parse(c.rewardDescription); } catch {}
            const total = prizes?.reduce((s, p) => s + p.amount, 0);
            return (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm backdrop-blur">
                <Trophy className="size-4" />
                {total ? `$${total.toLocaleString()} in prizes` : `Prize: ${c.rewardDescription}`}
              </div>
            );
          })()}
          {c.rewardDescription && (
          <div className="mt-5 rounded-2xl bg-black/50 p-5 backdrop-blur">
            <p className="text-sm font-bold uppercase tracking-widest text-white/70">
              How to qualify for prizes
            </p>
            <ul className="mt-3 space-y-3">
              <li className="flex items-start gap-3 text-white">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs font-bold">1</span>
                <span className="text-base leading-snug">
                  <strong>Complete your daily workout</strong> in the app — mark it done each day.
                </span>
              </li>
              <li className="flex items-start gap-3 text-white">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs font-bold">2</span>
                <span className="text-base leading-snug">
                  <strong>Post on Instagram every single day</strong> — share your workout, how you're feeling, or your progress.
                </span>
              </li>
              <li className="flex items-start gap-3 text-white">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs font-bold">3</span>
                <span className="text-base leading-snug">
                  <strong>Use the hashtag on every post:</strong>{" "}
                  <span className="rounded bg-white/20 px-2 py-0.5 font-mono font-bold text-white">
                    #communitychallenge26
                  </span>
                  {" "}— this is how we find your entries.
                </span>
              </li>
            </ul>
          </div>
          )}
        </div>
      </div>

      {/* Prize breakdown — shown when rewardDescription is a structured JSON array */}
      {(() => {
        let prizes: Array<{ category: string; amount: number }> | null = null;
        try { prizes = c.rewardDescription ? JSON.parse(c.rewardDescription) : null; } catch {}
        if (!prizes || !Array.isArray(prizes) || prizes.length === 0) return null;
        const total = prizes.reduce((s, p) => s + p.amount, 0);
        return (
          <div className="mt-6 rounded-2xl border-2 border-yellow-400/30 bg-yellow-50/50 p-5 dark:bg-yellow-900/10">
            <div className="flex items-center gap-2 font-display text-lg font-bold">
              <Trophy className="size-5 text-yellow-500" />
              Prize Pool — ${total.toLocaleString()}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {prizes.map((p) => (
                <div key={p.category} className="flex items-center justify-between rounded-xl border bg-background px-4 py-3">
                  <span className="text-sm font-medium">{p.category}</span>
                  <span className="font-display text-base font-bold text-yellow-600 dark:text-yellow-400">
                    ${p.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* "How it works" — copy adapts to day-based vs week-based challenges */}
      <div className="mt-6 rounded-2xl border-2 border-primary/20 bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
            <span className="text-sm font-bold">i</span>
          </div>
          <div className="text-sm">
            <div className="font-display text-base font-bold">How this challenge works</div>
            {isWeekGrouped ? (
              <>
                <p className="mt-1 text-foreground/80">
                  <strong>{uniqueWorkoutIds.size} workouts across {weekGroups.length} weeks</strong> — {weekGroups.length === 3 ? "3" : weekGroups.length} workouts per week. All videos are available from day one.
                </p>
                <p className="mt-2 text-foreground/80">
                  Work through each week in order, then mark each workout complete as you go.
                  Show up consistently — even 10 minutes counts.
                </p>
              </>
            ) : unit === "day" ? (
              <>
                <p className="mt-1 text-foreground/80">
                  <strong>{days.length} videos across {days.length} days.</strong> All workouts
                  are available from day one — hop in wherever you are and work through them
                  at your own pace.
                </p>
                <p className="mt-2 text-foreground/80">
                  Show up daily — even 10 minutes counts. Consistency beats intensity, and
                  missing a day is fine: your freeze tokens kick in automatically to keep
                  your streak alive.
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-foreground/80">
                  You'll get <strong>one new workout each week</strong>. Repeat that same
                  workout daily for the full 7 days — that's how you build the muscle memory
                  and see real results. After 7 days, the next week unlocks.
                </p>
                <p className="mt-2 text-foreground/80">
                  <strong>
                    {days.length} weeks × 7 days = {days.length * 7} days of progressive
                    transformation.
                  </strong>{" "}
                  Show up daily, even if you can only do 10 minutes — consistency beats
                  intensity.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Reward ladder ─────────────────────────────────────────── */}
      {CHALLENGE_REWARDS[c.slug] && (
        <div className="mt-6 rounded-2xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Gift className="size-5 text-primary" />
            <h2 className="font-display text-base font-bold">What you can earn</h2>
            <span className="ml-auto text-xs text-muted-foreground">Highest milestone wins</span>
          </div>
          <div className="space-y-3">
            {CHALLENGE_REWARDS[c.slug].map((tier) => {
              const isEarned = membership ? completedCheckable >= tier.minCompleted : false;
              const isNext = !isEarned && membership && tier === CHALLENGE_REWARDS[c.slug].find(t => completedCheckable < t.minCompleted);
              const remaining = tier.minCompleted - completedCheckable;
              return (
                <div
                  key={tier.minCompleted}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                    isEarned
                      ? "bg-green-50 dark:bg-green-900/15"
                      : isNext
                      ? "border border-primary/30 bg-primary/5"
                      : "bg-muted/40"
                  }`}
                >
                  {/* Milestone badge */}
                  <div
                    className={`flex size-10 shrink-0 flex-col items-center justify-center rounded-full text-center font-bold leading-tight ${
                      isEarned
                        ? "bg-green-500 text-white"
                        : isNext
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isEarned ? (
                      <Check className="size-5" />
                    ) : (
                      <>
                        <span className="text-[10px] font-extrabold leading-none">{isWeekGrouped ? "WK" : "DAY"}</span>
                        <span className="text-sm font-extrabold leading-tight">{tier.minCompleted}</span>
                      </>
                    )}
                  </div>

                  {/* Label + items */}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-bold ${isEarned ? "text-green-800 dark:text-green-300" : ""}`}>
                      {tier.emoji} {tier.label}
                    </p>
                    <p className={`text-xs ${isEarned ? "text-green-700/80 dark:text-green-400" : "text-muted-foreground"}`}>
                      {tier.items.join(" + ")}
                    </p>
                  </div>

                  {/* Status pill */}
                  {isEarned ? (
                    <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700 dark:bg-green-900/40 dark:text-green-400">
                      Earned ✓
                    </span>
                  ) : isNext && membership ? (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                      {remaining} to go
                    </span>
                  ) : !membership ? null : (
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      Locked
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {!membership && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Join the challenge to start earning rewards.
            </p>
          )}
        </div>
      )}

      {/* ── Reward banner ──────────────────────────────────────────── */}
      {earnedReward && (
        <div className="mt-6 flex items-start gap-4 rounded-2xl border-2 border-yellow-400/40 bg-yellow-50/60 p-5 dark:bg-yellow-900/10">
          <span className="text-3xl leading-none">{earnedReward.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="font-display text-base font-bold text-yellow-800 dark:text-yellow-300">
              You&apos;ve earned a reward!
            </p>
            <p className="mt-0.5 text-sm font-semibold text-yellow-700 dark:text-yellow-400">
              {earnedReward.label} — {earnedReward.items.join(" + ")}
            </p>
            <p className="mt-2 text-xs text-yellow-700/70 dark:text-yellow-500">
              The Infinity Hoop team will be in touch to arrange delivery. Make sure your email is up to date in your profile.
            </p>
            {nextReward && (
              <p className="mt-2 text-xs font-semibold text-yellow-700/80 dark:text-yellow-500">
                Keep going — {nextReward.remaining} more to unlock {nextReward.items.join(" + ")}!
              </p>
            )}
          </div>
        </div>
      )}
      {!earnedReward && nextReward && membership && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border bg-card p-4">
          <span className="text-2xl leading-none">{nextReward.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {nextReward.remaining} more {isWeekGrouped ? "workout" : "day"}{nextReward.remaining !== 1 ? "s" : ""} to earn your next reward
            </p>
            <p className="text-xs text-muted-foreground">{nextReward.items.join(" + ")}</p>
          </div>
        </div>
      )}

      {/* Live check-in feed */}
      {recentCheckins.length > 0 && (
        <div className="mt-6 rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="font-display text-base font-bold">🔥 Members checking in</div>
            {todayCheckinsCount > 0 && (
              <span className="text-sm font-semibold text-primary">
                {todayCheckinsCount} today
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex -space-x-2">
              {recentCheckins.slice(0, 6).map((ci, i) => (
                <Avatar key={i} className="size-9 ring-2 ring-background">
                  <AvatarImage src={ci.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {(ci.firstName ?? "?").slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            {recentCheckins.length > 1 && (
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{recentCheckins[0].firstName}</span>
                {" "}and{" "}
                {recentCheckins.length === 2
                  ? <><span className="font-semibold text-foreground">{recentCheckins[1].firstName}</span> are checking in</>
                  : <>{recentCheckins.length - 1} others are checking in</>
                }
              </p>
            )}
          </div>
          <div className="mt-4 space-y-2.5">
            {recentCheckins.slice(0, 4).map((ci, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm">
                <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="font-semibold">
                  {ci.firstName}{ci.lastName ? ` ${ci.lastName.slice(0, 1)}.` : ""}
                </span>
                <span className="text-muted-foreground">
                  completed {Unit} {ci.dayNumber}
                </span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {timeAgo(ci.completedAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!membership ? (
        <div className="mt-8 rounded-2xl border bg-card p-8 text-center">
          <h2 className="font-display text-2xl font-bold">Ready to commit?</h2>
          <p className="mt-2 text-muted-foreground">
            {isWeekGrouped ? (
              <>
                Join the challenge and get instant access to all {uniqueWorkoutIds.size} workouts across {weekGroups.length} weeks. Work through each week at your own pace — consistency beats intensity.
              </>
            ) : unit === "day" ? (
              <>
                Join the challenge and get instant access to all {days.length} workouts.
                Work through them day by day — miss a day? Your freeze tokens keep your
                streak alive automatically.
              </>
            ) : (
              <>
                Join the challenge and unlock Week 1 instantly. You'll repeat Week 1's
                workout daily for 7 days, then Week 2 unlocks. Miss a day? Use a freeze
                token to keep your streak alive.
              </>
            )}
          </p>
          <form action={joinChallenge.bind(null, c.id)} className="mt-6">
            <Button variant="gradient" size="lg" type="submit">
              I'm in — start {Unit} 1
            </Button>
          </form>
        </div>
      ) : (
        <div className="mt-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your progress</div>
              <div className="font-display text-2xl font-bold">
                {isWeekGrouped
                  ? `Workout ${completedCheckable} of ${totalCheckable}`
                  : `${Unit} ${currentDay} of ${Math.max(days.length, 1)}`}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Completed</div>
              <div className="font-display text-2xl font-bold">{completedCheckable}</div>
            </div>
          </div>
          <Progress value={(completedCheckable / Math.max(totalCheckable, 1)) * 100} />

          {c.rewardDescription && (() => {
            let prizes: unknown = null;
            try { prizes = JSON.parse(c.rewardDescription); } catch {}
            if (!Array.isArray(prizes) || prizes.length === 0) return null;
            return (
              <div className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-50/40 px-4 py-3 dark:bg-yellow-900/10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Trophy className="size-4 shrink-0 text-yellow-500" />
                    <span>$2,000 in prizes — submit your entries!</span>
                  </div>
                  <Button asChild size="sm" variant="gradient" className="w-full sm:w-auto">
                    <Link href={`/challenges/${slug}/contest`}>Enter contest →</Link>
                  </Button>
                </div>
              </div>
            );
          })()}

          {membership.completedAt && (
            <Card className="mt-6 border-primary/40 bg-primary/8">
              <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                    🎉 You finished
                  </div>
                  <div className="mt-1 font-display text-xl font-bold">
                    Your certificate is waiting
                  </div>
                </div>
                <Button asChild variant="gradient" size="sm">
                  <Link href={`/challenges/${slug}/complete`}>
                    Open celebration page →
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {resources.length > 0 && (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="size-5 text-primary" />
                  Cheat sheets & downloads
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {resources.map((r) => {
                  const Icon =
                    r.fileType === "pdf"
                      ? FileText
                      : r.fileType === "image"
                        ? ImageIcon
                        : FileType2;
                  return (
                    <a
                      key={r.id}
                      href={r.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={r.fileName}
                      className="flex items-center gap-3 rounded-xl border bg-background p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{r.title}</div>
                        {r.description && (
                          <div className="line-clamp-1 text-xs text-muted-foreground">
                            {r.description}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {r.fileType.toUpperCase()} · {(r.fileSize / 1024).toFixed(0)} KB
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-primary">Download</span>
                    </a>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {isWeekGrouped ? (
            /* Week-grouped view: Week 1/2/3 headers with 3 workout cards each */
            <div className="mt-8 space-y-8">
              {weekGroups.map(({ weekNum, uniqueDays }) => (
                <div key={weekNum}>
                  <h3 className="mb-4 font-display text-xl font-bold">Week {weekNum}</h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {uniqueDays.map((d, workoutIdx) => {
                      const done = isWorkoutCardDone(d);
                      const w = d.workoutId ? workoutById.get(d.workoutId) : null;
                      const thumb =
                        w?.muxPlaybackId
                          ? muxThumbnail(w.muxPlaybackId, { width: 640 })
                          : w?.cfStreamUid
                          ? cfThumbnail(w.cfStreamUid, w.cfCustomerCode, { time: "5s", width: 640 })
                          : null;
                      const workoutLabel = `Workout ${workoutIdx + 1}`;

                      return (
                        <div
                          key={d.id}
                          id={`day-${d.dayNumber}`}
                          className={`relative scroll-mt-20 overflow-hidden rounded-2xl border bg-card transition-all ${
                            done ? "border-primary/40 ring-2 ring-primary/20" : ""
                          }`}
                        >
                          <div className="relative aspect-video overflow-hidden bg-muted">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt={d.title ?? workoutLabel}
                                className="size-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center hoop-gradient-bold">
                                <PlayCircle className="size-12 text-white/70" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                            <Badge className="absolute left-3 top-3" variant="outline">
                              {workoutLabel}
                            </Badge>
                            {done && (
                              <div className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-primary text-white">
                                <Check className="size-5" />
                              </div>
                            )}
                          </div>
                          <div className="p-4">
                            <h3 className="font-display text-lg font-bold">
                              {d.title ?? workoutLabel}
                            </h3>
                            {d.description && (
                              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                {d.description}
                              </p>
                            )}
                            <div className="mt-3 space-y-2">
                              {w?.slug && (
                                <Button asChild size="sm" variant="gradient" className="w-full">
                                  <Link href={workoutHref(w.slug, { kind: "challenge", slug, day: d.dayNumber })}>
                                    <PlayCircle /> Watch {workoutLabel}
                                  </Link>
                                </Button>
                              )}
                              {!done && membership && (
                                <ChallengeCheckinButton
                                  memberId={membership.id}
                                  dayNumber={d.dayNumber}
                                  totalDays={days.length}
                                />
                              )}
                              {done && (
                                <p className="text-center text-xs font-semibold text-primary">
                                  ✓ Workout complete. Keep going!
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Flat grid: one card per day (standard day-unit or week-unit challenges) */
            <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {days.map((d) => {
                // Week-based challenges unlock one week at a time.
                // Day-based challenges have all content available immediately.
                const locked = unit === "week" && d.dayNumber > currentDay;
                const done = completedDays.has(d.dayNumber);
                const isToday = d.dayNumber === currentDay;
                const w = d.workoutId ? workoutById.get(d.workoutId) : null;
                const thumb =
                  w?.cfStreamUid
                    ? cfThumbnail(w.cfStreamUid, w.cfCustomerCode, { time: "5s", width: 640 })
                    : null;

                return (
                  <div
                    key={d.id}
                    id={`day-${d.dayNumber}`}
                    className={`relative scroll-mt-20 overflow-hidden rounded-2xl border bg-card transition-all ${
                      done ? "border-primary/40 ring-2 ring-primary/20" : ""
                    } ${locked ? "opacity-60" : ""}`}
                  >
                    <div className="relative aspect-video overflow-hidden bg-muted">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={d.title ?? `${Unit} ${d.dayNumber}`}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center hoop-gradient-bold">
                          <PlayCircle className="size-12 text-white/70" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <Badge
                        className="absolute left-3 top-3"
                        variant={isToday ? "default" : "outline"}
                      >
                        {Unit} {d.dayNumber}
                      </Badge>
                      <div className="absolute right-3 top-3">
                        {done ? (
                          <div className="flex size-8 items-center justify-center rounded-full bg-primary text-white">
                            <Check className="size-5" />
                          </div>
                        ) : locked ? (
                          <div className="flex size-8 items-center justify-center rounded-full bg-black/60 text-white">
                            <Lock className="size-4" />
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="p-4">
                      <h3 className="font-display text-lg font-bold">
                        {d.title ?? `${Unit} ${d.dayNumber}`}
                      </h3>
                      {!locked && unit === "week" && (
                        <p className="mt-1 text-xs font-semibold text-primary">
                          Repeat daily for 7 days
                        </p>
                      )}
                      {d.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {d.description}
                        </p>
                      )}

                      <div className="mt-3 space-y-2">
                        {!locked && w?.slug && (
                          <Button asChild size="sm" variant="gradient" className="w-full">
                            <Link href={workoutHref(w.slug, { kind: "challenge", slug, day: d.dayNumber })}>
                              <PlayCircle /> Watch {Unit} {d.dayNumber}
                            </Link>
                          </Button>
                        )}
                        {!locked && !done && membership && (
                          <ChallengeCheckinButton
                            memberId={membership.id}
                            dayNumber={d.dayNumber}
                            totalDays={days.length}
                          />
                        )}
                        {done && (
                          <p className="text-center text-xs font-semibold text-primary">
                            ✓ {Unit} complete. Keep going!
                          </p>
                        )}
                        {locked && (
                          <p className="text-center text-xs text-muted-foreground">
                            Unlocks after {Unit} {d.dayNumber - 1}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
