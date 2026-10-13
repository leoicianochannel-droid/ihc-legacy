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
} from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { logActivity } from "@/lib/streak";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function markWorkoutComplete(workoutId: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { error: "not_authenticated" };

  const [u] = await db
    .select({ id: users.id, timezone: users.timezone })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  if (!u) return { error: "no_user" };

  const streak = await logActivity({
    userId: u.id,
    type: "workout_completed",
    referenceId: workoutId,
    timezone: u.timezone ?? undefined,
  });

  revalidatePath("/dashboard");

  // If this workout is linked to a challenge day, auto-log the challenge check-in
  // so members don't have to click two separate "done" buttons.
  const [linkedDay] = await db
    .select({
      id: challengeDays.id,
      dayNumber: challengeDays.dayNumber,
      challengeId: challengeDays.challengeId,
      workoutId: challengeDays.workoutId,
    })
    .from(challengeDays)
    .where(eq(challengeDays.workoutId, workoutId))
    .limit(1);

  if (linkedDay) {
    // Find all challenge days for this challenge (needed for week-grouped detection)
    const allCDays = await db
      .select({ dayNumber: challengeDays.dayNumber, workoutId: challengeDays.workoutId })
      .from(challengeDays)
      .where(eq(challengeDays.challengeId, linkedDay.challengeId));

    const uniqueWids = new Set(allCDays.map(d => d.workoutId).filter(Boolean));
    const isWeekGrouped =
      uniqueWids.size > 0 &&
      uniqueWids.size < allCDays.length &&
      allCDays.length > 6;

    // For week-grouped challenges, use the representative day (first occurrence in the week)
    // so the dupe check and sibling logic align with the challenge page.
    let dayNumber = linkedDay.dayNumber;
    if (isWeekGrouped && linkedDay.workoutId) {
      const weekStart = Math.floor((linkedDay.dayNumber - 1) / 7) * 7 + 1;
      const weekEnd = weekStart + 6;
      const firstInWeek = allCDays
        .filter(
          d => d.workoutId === linkedDay.workoutId &&
               d.dayNumber >= weekStart && d.dayNumber <= weekEnd
        )
        .sort((a, b) => a.dayNumber - b.dayNumber)[0];
      if (firstInWeek) dayNumber = firstInWeek.dayNumber;
    }

    const [mem] = await db
      .select()
      .from(challengeMembers)
      .where(
        and(
          eq(challengeMembers.challengeId, linkedDay.challengeId),
          eq(challengeMembers.userId, u.id)
        )
      )
      .limit(1);

    if (mem && !mem.completedAt) {
      const [dupe] = await db
        .select({ id: challengeCheckins.id })
        .from(challengeCheckins)
        .where(
          and(
            eq(challengeCheckins.challengeMemberId, mem.id),
            eq(challengeCheckins.dayNumber, dayNumber)
          )
        )
        .limit(1);

      if (!dupe) {
        await db.insert(challengeCheckins).values({
          challengeMemberId: mem.id,
          dayNumber,
        });

        // For week-grouped challenges, also insert sibling days (same week, same workout)
        if (isWeekGrouped && linkedDay.workoutId) {
          const weekStart = Math.floor((dayNumber - 1) / 7) * 7 + 1;
          const weekEnd = weekStart + 6;
          const siblings = allCDays.filter(
            d => d.dayNumber !== dayNumber &&
                 d.dayNumber >= weekStart && d.dayNumber <= weekEnd &&
                 d.workoutId === linkedDay.workoutId
          );
          for (const sib of siblings) {
            await db.execute(sql`
              INSERT INTO challenge_checkins (challenge_member_id, day_number)
              SELECT ${mem.id}, ${sib.dayNumber}
              WHERE NOT EXISTS (
                SELECT 1 FROM challenge_checkins
                WHERE challenge_member_id = ${mem.id} AND day_number = ${sib.dayNumber}
              )
            `);
          }
        }

        const [challenge] = await db
          .select({ slug: challenges.slug, durationDays: challenges.durationDays })
          .from(challenges)
          .where(eq(challenges.id, linkedDay.challengeId))
          .limit(1);

        // Calculate totalUnits the same way the challenge page does
        let totalUnits: number;
        if (isWeekGrouped) {
          const seen = new Set<string>();
          for (const d of allCDays) {
            if (!d.workoutId) continue;
            const weekIdx = Math.floor((d.dayNumber - 1) / 7);
            seen.add(`${weekIdx}:${d.workoutId}`);
          }
          totalUnits = seen.size;
        } else {
          totalUnits =
            allCDays.length || (challenge?.durationDays ?? mem.currentDay + 1);
        }

        const proposedNext = mem.currentDay + 1;
        const isComplete = proposedNext > totalUnits;
        const nextCurrentDay = isComplete ? totalUnits : proposedNext;

        await db
          .update(challengeMembers)
          .set({
            currentDay: nextCurrentDay,
            completedAt: isComplete && !mem.completedAt ? new Date() : mem.completedAt,
          })
          .where(eq(challengeMembers.id, mem.id));

        revalidatePath(`/challenges`);
        if (challenge?.slug) revalidatePath(`/challenges/${challenge.slug}`);
        revalidatePath("/dashboard");

        if (isComplete && challenge?.slug) {
          redirect(`/challenges/${challenge.slug}/complete`);
        }
      }
    }
  }

  return { ok: true, streak };
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
