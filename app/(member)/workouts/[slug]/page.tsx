import type React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db, workouts, users, workoutRatings, workoutComments, activityLog, challenges, programs } from "@/lib/db";
import { contextHref, parseWorkoutContext } from "@/lib/workout-context";
import { eq, and, asc, inArray } from "drizzle-orm";
import { WORKOUT_COMPLETIONS } from "@/lib/workout-completions";
import { CHALLENGE_REWARDS } from "@/lib/challenge-rewards";
import { DiscountCodeReveal } from "@/components/workout/discount-code-reveal";
import { getEffectiveUnlockDay } from "@/lib/workout-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Flame, ChevronLeft, Lock } from "lucide-react";
import { WorkoutPlayer } from "./player";
import { MuxWorkoutPlayer } from "./mux-player";
import { PresenceHeartbeat } from "@/components/live/presence-heartbeat";
import { LivePill } from "@/components/live/live-pill";
import { WorkoutRating } from "@/components/member/workout-rating";
import { TranscriptViewer } from "@/components/member/transcript-viewer";
import { WorkoutComments } from "./workout-comments";

export default async function WorkoutDetail({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ challenge?: string; program?: string; day?: string }>;
}) {
  const { slug } = await params;
  const ctx = parseWorkoutContext(await searchParams);
  const [w] = await db.select().from(workouts).where(eq(workouts.slug, slug)).limit(1);
  if (!w) notFound();

  // Fetch current user, their rating, workout comments, and lock state
  const { userId: clerkId } = await auth();
  let existingRating: number | null = null;
  let currentUserId: string | null = null;
  let memberDays = 0;
  let hasCompleted = false;

  const rawComments = await db
    .select({
      id: workoutComments.id,
      body: workoutComments.body,
      createdAt: workoutComments.createdAt,
      userId: workoutComments.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
    })
    .from(workoutComments)
    .innerJoin(users, eq(workoutComments.userId, users.id))
    .where(eq(workoutComments.workoutId, w.id))
    .orderBy(asc(workoutComments.createdAt))
    .limit(200)
    .catch(() => []);

  if (clerkId) {
    const [me] = await db
      .select({ id: users.id, onboardedAt: users.onboardedAt, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);
    if (me) {
      currentUserId = me.id;

      const start = me.onboardedAt ?? me.createdAt;
      memberDays = Math.floor((Date.now() - new Date(start).getTime()) / (1000 * 60 * 60 * 24));

      const [r, [completion]] = await Promise.all([
        db
          .select({ rating: workoutRatings.rating })
          .from(workoutRatings)
          .where(and(eq(workoutRatings.userId, me.id), eq(workoutRatings.workoutId, w.id)))
          .limit(1),
        db
          .select({ id: activityLog.id })
          .from(activityLog)
          .where(
            and(
              eq(activityLog.userId, me.id),
              eq(activityLog.type, "workout_completed"),
              eq(activityLog.referenceId, w.id)
            )
          )
          .limit(1),
      ]);
      existingRating = r[0]?.rating ?? null;
      hasCompleted = !!completion;
    }
  }

  // Where "back" goes: the challenge/program day this was opened from.
  let back = { href: "/workouts", label: "All workouts", short: null as string | null };
  if (ctx) {
    const [src] =
      ctx.kind === "challenge"
        ? await db.select({ title: challenges.title }).from(challenges).where(eq(challenges.slug, ctx.slug)).limit(1)
        : await db.select({ title: programs.title }).from(programs).where(eq(programs.slug, ctx.slug)).limit(1);
    if (src) back = { href: contextHref(ctx), label: `${src.title} · Day ${ctx.day}`, short: `Day ${ctx.day}` };
  }

  // Lock gate — grandfather anyone who's previously done this workout
  const unlockDay = getEffectiveUnlockDay(w);
  const isLocked = unlockDay !== null && memberDays < unlockDay && !hasCompleted;
  if (isLocked) {
    const daysLeft = unlockDay - memberDays;
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="mb-6 flex justify-start">
          <Button asChild variant="ghost" size="sm">
            <Link href={back.href}><ChevronLeft /> {back.label}</Link>
          </Button>
        </div>
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-muted">
          <Lock className="size-9 text-muted-foreground" />
        </div>
        <h1 className="mt-6 font-display text-2xl font-bold">{w.title}</h1>
        <p className="mt-2 text-muted-foreground">
          This workout unlocks on Day {unlockDay}.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          You're on Day {memberDays}.{" "}
          {daysLeft === 1 ? "just 1 more day!" : `${daysLeft} more days to go.`}
        </p>
        <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, Math.round((memberDays / unlockDay) * 100))}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Day {memberDays} of {unlockDay}
        </p>
        <Button asChild variant="gradient" className="mt-8">
          <Link href="/workouts">Browse available workouts</Link>
        </Button>
      </div>
    );
  }

  const comments = rawComments.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt,
    userId: c.userId,
    authorName: [c.firstName, c.lastName].filter(Boolean).join(" ") || "Member",
    authorAvatar: c.avatarUrl,
  }));

  // Post-completion content for special workouts
  const completionConfig = WORKOUT_COMPLETIONS[w.slug];
  let postCompletion: React.ReactNode = null;
  if (completionConfig?.type === "discount-code") {
    postCompletion = (
      <DiscountCodeReveal code={completionConfig.code} label={completionConfig.label} />
    );
  } else if (completionConfig?.type === "challenge-funnel") {
    const funnelChallenges = await db
      .select({ slug: challenges.slug, title: challenges.title })
      .from(challenges)
      .where(inArray(challenges.slug, completionConfig.challengeSlugs));
    if (funnelChallenges.length > 0) {
      postCompletion = (
        <div className="mt-4 rounded-2xl border-2 border-primary/30 bg-primary/5 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-primary/20 px-4 py-2.5">
            <span className="text-base">🏆</span>
            <p className="text-sm font-bold text-primary">Keep the momentum going!</p>
          </div>
          <div className="p-4">
            <p className="text-xs text-muted-foreground mb-3">
              Join a challenge and earn physical prizes for staying consistent:
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {funnelChallenges.map((ch) => {
                const topReward = CHALLENGE_REWARDS[ch.slug]?.at(-1);
                return (
                  <a
                    key={ch.slug}
                    href={`/challenges/${ch.slug}`}
                    className="flex flex-col gap-1 rounded-xl border bg-background px-4 py-3 transition-colors hover:border-primary/50 hover:bg-primary/5"
                  >
                    <span className="text-sm font-bold">{ch.title}</span>
                    {topReward && (
                      <span className="text-xs text-muted-foreground">
                        {topReward.emoji} Top reward: {topReward.items.join(" + ")}
                      </span>
                    )}
                    <span className="mt-1 text-xs font-semibold text-primary">Join challenge →</span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-10 md:py-8">
      <PresenceHeartbeat workoutId={w.id} />

      <div className="mb-4 flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={back.href}><ChevronLeft /> {back.label}</Link>
        </Button>
        <LivePill variant="compact" />
      </div>

      <div className="overflow-hidden rounded-2xl bg-black">
        {w.cfStreamUid ? (
          <WorkoutPlayer
            cfStreamUid={w.cfStreamUid}
            cfCustomerCode={w.cfCustomerCode}
            workoutId={w.id}
            title={w.title}
            postCompletion={postCompletion}
            ctx={ctx}
            backLabel={back.short}
          />
        ) : w.muxPlaybackId ? (
          <MuxWorkoutPlayer
            playbackId={w.muxPlaybackId}
            workoutId={w.id}
            title={w.title}
            ctx={ctx}
            backLabel={back.short}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center text-center text-white/70 px-6">
            This video is almost ready. Check back in a few hours.
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="capitalize">{w.intensity}</Badge>
          <Badge variant="outline"><Clock className="mr-1 size-3" /> {w.durationMin} min</Badge>
          {w.caloriesBurnedEst && (
            <Badge variant="outline"><Flame className="mr-1 size-3" /> ~{w.caloriesBurnedEst} cal</Badge>
          )}
        </div>

        <h1 className="mt-3 font-display text-3xl font-bold md:text-4xl">{w.title}</h1>
        {w.instructor && (
          <p className="mt-1 text-sm text-muted-foreground">with {w.instructor}</p>
        )}

        {w.description && (
          <p className="mt-4 leading-relaxed text-foreground/80">{w.description}</p>
        )}

        {/* Rating widget */}
        <WorkoutRating workoutId={w.id} initialRating={existingRating} />

        {/* Transcript (only shown when one has been added) */}
        {w.transcript && w.transcript.length > 0 && (
          <TranscriptViewer segments={w.transcript} />
        )}

        <WorkoutComments
          workoutId={w.id}
          initialComments={comments}
          currentUserId={currentUserId}
        />

        {/* Detail grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {w.bodyFocus.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Body Focus</p>
              <p className="mt-1 text-sm font-semibold capitalize">{w.bodyFocus.join(", ")}</p>
            </div>
          )}
          {w.equipment.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Equipment</p>
              <p className="mt-1 text-sm font-semibold capitalize">{w.equipment.join(", ")}</p>
            </div>
          )}
          <div className="rounded-xl border bg-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Intensity</p>
            <p className="mt-1 text-sm font-semibold capitalize">{w.intensity}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Duration</p>
            <p className="mt-1 text-sm font-semibold">{w.durationMin} minutes</p>
          </div>
          {w.caloriesBurnedEst && (
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Est. Calories</p>
              <p className="mt-1 text-sm font-semibold">~{w.caloriesBurnedEst} cal</p>
            </div>
          )}
          {w.collection && (
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Collection</p>
              <p className="mt-1 text-sm font-semibold">{w.collection}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
