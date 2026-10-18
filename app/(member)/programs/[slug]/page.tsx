import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import {
  db,
  users,
  programs,
  programDays,
  programDayExercises,
  programMembers,
  programDayCompletions,
  workouts,
  activityLog,
} from "@/lib/db";
import { eq, and, asc, inArray, sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { ChevronLeft, PartyPopper } from "lucide-react";
import { noDashes } from "@/lib/utils";
import { ProgramDayCard } from "./program-day-card";
import { joinProgram } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProgramDetail({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { slug } = await params;
  const openDay = Number((await searchParams).day) || null;
  const { userId: clerkId } = await auth();

  const [program] = await db.select().from(programs).where(eq(programs.slug, slug)).limit(1);
  if (!program) notFound();

  const days = await db
    .select()
    .from(programDays)
    .where(eq(programDays.programId, program.id))
    .orderBy(asc(programDays.dayNumber));

  // Pull all exercises for these days in one query
  const dayIds = days.map((d) => d.id);
  const allExercises = dayIds.length
    ? await db
        .select()
        .from(programDayExercises)
        .where(inArray(programDayExercises.programDayId, dayIds))
        .orderBy(asc(programDayExercises.sortOrder))
    : [];

  // Group exercises by programDayId
  const exercisesByDay = new Map<string, typeof allExercises>();
  for (const ex of allExercises) {
    if (!exercisesByDay.has(ex.programDayId)) exercisesByDay.set(ex.programDayId, []);
    exercisesByDay.get(ex.programDayId)!.push(ex);
  }

  // Pull all linked workouts in one query
  const workoutIds = allExercises
    .map((e) => e.workoutId)
    .filter((id): id is string => !!id);
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
        .from(programMembers)
        .where(and(eq(programMembers.programId, program.id), eq(programMembers.userId, me.id)))
        .limit(1)
    : [null];

  const completed = membership
    ? await db
        .select()
        .from(programDayCompletions)
        .where(eq(programDayCompletions.programMemberId, membership.id))
    : [];
  const completedDays = new Set(completed.map((c) => c.dayNumber));
  const currentDay = membership?.currentDay ?? 1;
  const total = days.length || program.durationDays;
  const finished = !!membership?.completedAt || (total > 0 && completedDays.size >= total);

  // Which exercise videos the member has finished, per program day.
  const watched = membership
    ? await db
        .select({ ref: activityLog.referenceId, day: sql<number>`(${activityLog.meta}->>'programDay')::int` })
        .from(activityLog)
        .where(
          and(
            eq(activityLog.userId, membership.userId),
            eq(activityLog.type, "workout_completed"),
            sql`${activityLog.meta}->>'programMemberId' = ${membership.id}`,
          ),
        )
    : [];
  const watchedSet = new Set(watched.map((w) => `${w.day}:${w.ref}`));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-10 md:py-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
        <Link href="/challenges"><ChevronLeft /> Challenges</Link>
      </Button>

      {/* Header */}
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        {program.durationDays} day program
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold leading-tight">{program.title}</h1>
      {program.subtitle && <p className="mt-0.5 text-muted-foreground">{program.subtitle}</p>}
      {program.description && (
        <p className="mt-3 text-sm leading-relaxed text-foreground/80">{noDashes(program.description)}</p>
      )}

      {!membership ? (
        <div className="mt-5 rounded-2xl border bg-card p-5 text-center">
          <p className="font-semibold">Ready when you are</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Day 1 opens right away. Each new day opens when you finish the one before.
          </p>
          <form action={joinProgram.bind(null, program.id)} className="mt-4">
            <Button variant="gradient" size="lg" type="submit" className="w-full">
              Start Day 1
            </Button>
          </form>
        </div>
      ) : finished ? (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border bg-card p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <PartyPopper className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Program complete</p>
            <p className="text-sm text-muted-foreground">All {total} days done. Time to pick up the hoop.</p>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border bg-card p-4">
          <div className="flex items-baseline justify-between">
            <p className="font-semibold">
              Day {currentDay} <span className="font-normal text-muted-foreground">of {total}</span>
            </p>
            <p className="text-sm text-muted-foreground">{completedDays.size} done</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.round((completedDays.size / Math.max(total, 1)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-6 space-y-2">
        {days.map((d) => {
          const exercises = exercisesByDay.get(d.id) ?? [];
          const locked = program.unlockAll ? false : membership ? d.dayNumber > currentDay : d.dayNumber > 1;
          const done = completedDays.has(d.dayNumber);
          const isToday = !!membership && !finished && d.dayNumber === currentDay;

          return (
            <ProgramDayCard
              // Re-mount as progress changes so the right day opens itself.
              key={`${d.id}-${membership ? currentDay : 0}-${completedDays.size}`}
              programSlug={program.slug}
              day={{ ...d, title: noDashes(d.title), description: d.description ? noDashes(d.description) : null }}
              exercises={exercises.map((e) => {
                const w = e.workoutId ? workoutById.get(e.workoutId) ?? null : null;
                return {
                  id: e.id,
                  label: e.label,
                  repsLabel: e.repsLabel,
                  workout: w ? { slug: w.slug, title: w.title } : null,
                  done: done || (!!e.workoutId && watchedSet.has(`${d.dayNumber}:${e.workoutId}`)),
                };
              })}
              locked={locked}
              done={done}
              isToday={isToday}
              defaultOpen={
                // Coming back from a video: reopen that day, unless it just
                // got finished, in which case today's (next) day opens.
                openDay && !completedDays.has(openDay) ? d.dayNumber === openDay : isToday
              }
              membershipId={membership?.id ?? null}
            />
          );
        })}
      </div>
    </div>
  );
}
