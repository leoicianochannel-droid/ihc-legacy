"use server";

import { auth } from "@clerk/nextjs/server";
import {
  db,
  users,
  workoutRatings,
  workoutComments,
  challengeDays,
  challengeMembers,
  challengeCheckins,
  challenges,
  activityLog,
  programs,
  programDays,
  programDayExercises,
  programMembers,
} from "@/lib/db";
import { eq, and, asc, inArray, isNull, sql } from "drizzle-orm";
import { checkInChallengeDay } from "@/lib/challenge-checkin";
import { completeProgramDay } from "@/lib/program-progress";
import { contextHref, type WorkoutContext } from "@/lib/workout-context";
import { logActivity } from "@/lib/streak";
import { revalidatePath } from "next/cache";

export type WorkoutCompleteResult =
  | { ok: true; streak: Awaited<ReturnType<typeof logActivity>>; returnTo: string | null; message: string | null }
  | { error: string };

/**
 * Log a finished workout. When it was opened from a challenge or program day
 * (ctx), that exact day is ticked off and `returnTo` sends the member back to
 * it. Without ctx, any challenge the member is in that uses this video gets
 * its next unchecked day ticked off.
 */
export async function markWorkoutComplete(
  workoutId: string,
  ctx?: WorkoutContext | null,
): Promise<WorkoutCompleteResult> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { error: "not_authenticated" };

  const [u] = await db
    .select({ id: users.id, timezone: users.timezone })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  if (!u) return { error: "no_user" };

  // ── Program day: resolve before logging so the log records which day ──
  let programCtx: {
    mem: typeof programMembers.$inferSelect;
    slug: string;
    dayNumber: number;
    dayWorkoutIds: string[];
    allVideo: boolean;
  } | null = null;
  if (ctx?.kind === "program") {
    const [row] = await db
      .select({ program: programs, mem: programMembers, day: programDays })
      .from(programs)
      .innerJoin(programMembers, and(eq(programMembers.programId, programs.id), eq(programMembers.userId, u.id)))
      .innerJoin(programDays, and(eq(programDays.programId, programs.id), eq(programDays.dayNumber, ctx.day)))
      .where(eq(programs.slug, ctx.slug))
      .limit(1);
    if (row) {
      const exercises = await db
        .select({ workoutId: programDayExercises.workoutId })
        .from(programDayExercises)
        .where(eq(programDayExercises.programDayId, row.day.id));
      const ids = exercises.map((e) => e.workoutId).filter((id): id is string => !!id);
      if (ids.includes(workoutId)) {
        programCtx = {
          mem: row.mem,
          slug: row.program.slug,
          dayNumber: ctx.day,
          dayWorkoutIds: [...new Set(ids)],
          allVideo: exercises.length > 0 && exercises.every((e) => !!e.workoutId),
        };
      }
    }
  }

  const streak = await logActivity({
    userId: u.id,
    type: "workout_completed",
    referenceId: workoutId,
    meta: programCtx ? { programMemberId: programCtx.mem.id, programDay: programCtx.dayNumber } : undefined,
    timezone: u.timezone ?? undefined,
  });
  revalidatePath("/dashboard");

  if (programCtx) {
    const { mem, slug, dayNumber, dayWorkoutIds, allVideo } = programCtx;
    // Which of this day's videos has the member finished for this program day?
    const doneRows = await db
      .select({ ref: activityLog.referenceId })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.userId, u.id),
          eq(activityLog.type, "workout_completed"),
          inArray(activityLog.referenceId, dayWorkoutIds),
          sql`${activityLog.meta}->>'programMemberId' = ${mem.id}`,
          sql`(${activityLog.meta}->>'programDay')::int = ${dayNumber}`,
        ),
      );
    const doneIds = new Set(doneRows.map((r) => r.ref));
    const remaining = dayWorkoutIds.filter((id) => !doneIds.has(id)).length;

    let message: string;
    if (remaining === 0 && allVideo) {
      const res = await completeProgramDay(u, mem, dayNumber);
      message = res.finishedProgram ? "Program complete!" : `Day ${dayNumber} complete`;
    } else if (remaining === 0) {
      message = "All videos done. Tick off the day when you finish.";
    } else {
      message = `Nice. ${remaining} more to go today`;
    }
    revalidatePath(`/programs/${slug}`);
    return {
      ok: true,
      streak,
      returnTo: `/programs/${slug}?day=${dayNumber}#day-${dayNumber}`,
      message,
    };
  }

  // ── Challenge day ──
  const target = await findChallengeDay(u.id, workoutId, ctx?.kind === "challenge" ? ctx : null);
  if (target) {
    const result = await checkInChallengeDay(u, target.mem, target.dayNumber);
    revalidatePath("/challenges");
    revalidatePath(`/challenges/${target.slug}`);
    if (result.finishedSlug) {
      return { ok: true, streak, returnTo: `/challenges/${result.finishedSlug}/complete`, message: "Challenge complete!" };
    }
    if (ctx?.kind === "challenge") {
      return {
        ok: true,
        streak,
        returnTo: `/challenges/${target.slug}?day=${target.dayNumber}#day-${target.dayNumber}`,
        message: result.checkedIn ? `${target.label} ${target.dayNumber} checked off` : null,
      };
    }
  }

  if (ctx) {
    // Opened from a day we couldn't tick off (not joined yet, or the day
    // moved). Still take them back where they came from.
    return { ok: true, streak, returnTo: contextHref(ctx), message: null };
  }
  return { ok: true, streak, returnTo: null, message: null };
}

/**
 * The challenge day this finished workout should tick off: the day the
 * member came from (ctx), or else their earliest unchecked day (up to the
 * day they're on) that uses this video in a challenge they've joined.
 */
async function findChallengeDay(
  userId: string,
  workoutId: string,
  ctx: WorkoutContext | null,
): Promise<{ mem: typeof challengeMembers.$inferSelect; slug: string; dayNumber: number; label: string } | null> {
  const rows = await db
    .select({
      mem: challengeMembers,
      slug: challenges.slug,
      durationDays: challenges.durationDays,
      dayNumber: challengeDays.dayNumber,
      challengeId: challenges.id,
    })
    .from(challengeDays)
    .innerJoin(challenges, eq(challenges.id, challengeDays.challengeId))
    .innerJoin(
      challengeMembers,
      and(eq(challengeMembers.challengeId, challenges.id), eq(challengeMembers.userId, userId)),
    )
    .where(
      and(
        eq(challengeDays.workoutId, workoutId),
        isNull(challengeMembers.completedAt),
        ctx ? and(eq(challenges.slug, ctx.slug), eq(challengeDays.dayNumber, ctx.day)) : undefined,
      ),
    )
    .orderBy(asc(challengeDays.dayNumber));
  if (rows.length === 0) return null;

  let pick = rows[0];
  if (!ctx) {
    const done = await db
      .select({ memberId: challengeCheckins.challengeMemberId, day: challengeCheckins.dayNumber })
      .from(challengeCheckins)
      .where(inArray(challengeCheckins.challengeMemberId, [...new Set(rows.map((r) => r.mem.id))]));
    const doneSet = new Set(done.map((d) => `${d.memberId}:${d.day}`));
    // Only catch up on the current or an earlier day. Never jump ahead into
    // a future day/week just because the same video appears there.
    const open = rows.find(
      (r) => !doneSet.has(`${r.mem.id}:${r.dayNumber}`) && r.dayNumber <= r.mem.currentDay,
    );
    if (!open) return null;
    pick = open;
  }

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(challengeDays)
    .where(eq(challengeDays.challengeId, pick.challengeId));
  const label = Number(n) === pick.durationDays ? "Day" : "Week";
  return { mem: pick.mem, slug: pick.slug, dayNumber: pick.dayNumber, label };
}

export async function rateWorkout(
  workoutId: string,
  rating: number
): Promise<{ ok: boolean; error?: string }> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { ok: false, error: "not_authenticated" };

  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  if (!u) return { ok: false, error: "no_user" };

  if (rating < 1 || rating > 5) return { ok: false, error: "Invalid rating." };

  await db
    .insert(workoutRatings)
    .values({ userId: u.id, workoutId, rating })
    .onConflictDoUpdate({
      target: [workoutRatings.userId, workoutRatings.workoutId],
      set: { rating },
    });

  return { ok: true };
}

export async function addWorkoutComment(workoutId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 1000) return { error: "invalid" };

  const { userId: clerkId } = await auth();
  if (!clerkId) return { error: "not_authenticated" };

  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!u) return { error: "no_user" };

  await db.insert(workoutComments).values({ workoutId, userId: u.id, body: trimmed });
  revalidatePath(`/workouts`);
  return { ok: true };
}

export async function deleteWorkoutComment(commentId: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { error: "not_authenticated" };

  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!u) return { error: "no_user" };

  await db
    .delete(workoutComments)
    .where(and(eq(workoutComments.id, commentId), eq(workoutComments.userId, u.id)));

  revalidatePath(`/workouts`);
  return { ok: true };
}
