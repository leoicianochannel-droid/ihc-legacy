import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  db,
  users,
  activityLog,
  challengeDays,
  challengeMembers,
  challengeCheckins,
  challenges,
} from "@/lib/db";
import { and, eq, gte, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

const CHALLENGE_SLUG = "30-day-challenge";
const CURRENT_RUN_START = new Date("2026-07-01T00:00:00Z");

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [me] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  if (me?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  // Look up the member
  const [target] = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Find the 30-day challenge
  const [challenge] = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(eq(challenges.slug, CHALLENGE_SLUG))
    .limit(1);
  if (!challenge) return NextResponse.json({ error: "Challenge not found" }, { status: 404 });

  // Find their challenge membership
  const [membership] = await db
    .select()
    .from(challengeMembers)
    .where(
      and(
        eq(challengeMembers.challengeId, challenge.id),
        eq(challengeMembers.userId, target.id)
      )
    )
    .limit(1);
  if (!membership) return NextResponse.json({ error: "Not enrolled in challenge" }, { status: 404 });

  // Get all challenge days for this challenge (workoutId → dayNumber map)
  const days = await db
    .select({ workoutId: challengeDays.workoutId, dayNumber: challengeDays.dayNumber })
    .from(challengeDays)
    .where(eq(challengeDays.challengeId, challenge.id));

  const workoutToDayNumber = new Map(
    days.filter((d) => d.workoutId).map((d) => [d.workoutId!, d.dayNumber])
  );
  const challengeWorkoutIds = [...workoutToDayNumber.keys()];
  if (challengeWorkoutIds.length === 0) {
    return NextResponse.json({ error: "No workouts linked to challenge days" }, { status: 400 });
  }

  // Find their activityLog entries since July 1 for those workouts
  const logs = await db
    .select({ referenceId: activityLog.referenceId, createdAt: activityLog.createdAt })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.userId, target.id),
        eq(activityLog.type, "workout_completed"),
        gte(activityLog.createdAt, CURRENT_RUN_START),
        inArray(activityLog.referenceId, challengeWorkoutIds)
      )
    )
    .orderBy(activityLog.createdAt);

  // Get existing check-ins so we don't duplicate
  const existing = await db
    .select({ dayNumber: challengeCheckins.dayNumber })
    .from(challengeCheckins)
    .where(eq(challengeCheckins.challengeMemberId, membership.id));
  const alreadyDone = new Set(existing.map((r) => r.dayNumber));

  // Build list of days to backfill
  const toInsert: { challengeMemberId: string; dayNumber: number; completedAt: Date }[] = [];
  for (const log of logs) {
    if (!log.referenceId) continue;
    const dayNum = workoutToDayNumber.get(log.referenceId);
    if (dayNum === undefined) continue;
    if (alreadyDone.has(dayNum)) continue;
    alreadyDone.add(dayNum); // prevent dupes within this batch
    toInsert.push({
      challengeMemberId: membership.id,
      dayNumber: dayNum,
      completedAt: log.createdAt,
    });
  }

  if (toInsert.length > 0) {
    await db.insert(challengeCheckins).values(toInsert);

    // Advance currentDay to the highest checked-in day + 1 (capped at total days)
    const totalUnits = days.length || 30;
    const highestDay = Math.max(...[...alreadyDone]);
    const newCurrentDay = Math.min(highestDay + 1, totalUnits);

    if (newCurrentDay > membership.currentDay) {
      await db
        .update(challengeMembers)
        .set({ currentDay: newCurrentDay })
        .where(eq(challengeMembers.id, membership.id));
    }
  }

  return NextResponse.json({
    ok: true,
    member: `${target.firstName} ${target.lastName}`,
    daysBackfilled: toInsert.length,
    dayNumbers: toInsert.map((r) => r.dayNumber).sort((a, b) => a - b),
    alreadyHad: existing.length,
  });
}
