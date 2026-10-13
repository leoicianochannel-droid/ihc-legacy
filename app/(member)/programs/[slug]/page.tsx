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
} from "@/lib/db";
import { eq, and, asc, inArray } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, Lock, Check, PlayCircle, Coffee } from "lucide-react";
import { ProgramDayCard } from "./program-day-card";
import { joinProgram } from "./actions";

export default async function ProgramDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-10 md:py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/programs"><ChevronLeft /> All programs</Link>
      </Button>

      <div className="overflow-hidden rounded-2xl hoop-gradient-bold">
        <div className="relative p-8 text-white md:p-12">
          <Badge variant="gold">{program.durationDays}-day program</Badge>
          <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">{program.title}</h1>
          {program.subtitle && <p className="mt-1 opacity-90">{program.subtitle}</p>}
          {program.description && (
            <p className="mt-4 max-w-3xl opacity-90">{program.description}</p>
          )}
        </div>
      </div>

      {!membership ? (
        <div className="mt-6 rounded-2xl border bg-card p-6 text-center">
          <h2 className="font-display text-xl font-bold">Ready to start?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Day 1 unlocks instantly. New days unlock as you complete them.
          </p>
          <form action={joinProgram.bind(null, program.id)} className="mt-4">
            <Button variant="gradient" size="lg" type="submit">
              Start Day 1
            </Button>
          </form>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your progress
              </div>
              <div className="font-display text-2xl font-bold">
                Day {currentDay} of {days.length}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Completed
              </div>
              <div className="font-display text-2xl font-bold">{completedDays.size}</div>
            </div>
          </div>
          <Progress value={(completedDays.size / Math.max(days.length, 1)) * 100} className="mt-3" />
        </div>
      )}

      <div className="mt-6 space-y-3">
        {days.map((d) => {
          const exercises = exercisesByDay.get(d.id) ?? [];
          const locked = program.unlockAll ? false : membership ? d.dayNumber > currentDay : d.dayNumber > 1;
          const done = completedDays.has(d.dayNumber);

          return (
            <ProgramDayCard
              key={d.id}
              day={d}
              exercises={exercises.map((e) => ({
                id: e.id,
                label: e.label,
                repsLabel: e.repsLabel,
                workout: e.workoutId ? workoutById.get(e.workoutId) ?? null : null,
              }))}
              locked={locked}
              done={done}
              isToday={d.dayNumber === currentDay}
              membershipId={membership?.id ?? null}
            />
          );
        })}
      </div>
    </div>
  );
}
