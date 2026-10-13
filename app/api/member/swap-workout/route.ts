import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users, workouts, memberPlans } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { GeneratedPlan, PlanWorkoutRef } from "@/lib/plan-types";

/** GET ?weekIndex=0&currentWorkoutId=uuid — returns 4 swap alternatives (2 hoop guaranteed). */
export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [me] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const weekIndex = parseInt(searchParams.get("weekIndex") ?? "0");
  const currentWorkoutId = searchParams.get("currentWorkoutId") ?? "";

  const [planRecord] = await db
    .select({ plan: memberPlans.plan })
    .from(memberPlans)
    .where(eq(memberPlans.userId, me.id))
    .limit(1);
  if (!planRecord) return NextResponse.json({ error: "no_plan" }, { status: 404 });

  const plan = planRecord.plan as GeneratedPlan;
  const week = plan.weeks[weekIndex];
  if (!week) return NextResponse.json({ error: "invalid_week" }, { status: 400 });

  // Exclude every workout already in this week so there are no duplicates
  const weekWorkoutIds = new Set(week.workouts.map((w) => w.workoutId));
  const currentIntensity = week.workouts.find((w) => w.workoutId === currentWorkoutId)?.intensity ?? null;

  const allWorkouts = await db
    .select({
      id: workouts.id,
      slug: workouts.slug,
      title: workouts.title,
      intensity: workouts.intensity,
      durationMin: workouts.durationMin,
      thumbnailUrl: workouts.thumbnailUrl,
      usesHoop: workouts.usesHoop,
    })
    .from(workouts)
    .where(eq(workouts.challengeOnly, false));

  const available = allWorkouts.filter((w) => !weekWorkoutIds.has(w.id));

  const hoopPool = shuffle(available.filter((w) => w.usesHoop));
  const otherPool = shuffle(available.filter((w) => !w.usesHoop));

  const hoopPicks = pickWithFallback(hoopPool, currentIntensity, 2);
  const otherPicks = pickWithFallback(otherPool, currentIntensity, 2);

  const alternatives: PlanWorkoutRef[] = [...hoopPicks, ...otherPicks].map((w) => ({
    workoutId: w.id,
    slug: w.slug,
    title: w.title,
    durationMin: w.durationMin,
    intensity: w.intensity ?? "beginner",
    thumbnailUrl: w.thumbnailUrl,
  }));

  return NextResponse.json({
    alternatives,
    hoopIds: hoopPicks.map((w) => w.id),
  });
}

/** POST { weekIndex, workoutIndex, newWorkout } — commits the swap. */
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [me] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  const body: { weekIndex: number; workoutIndex: number; newWorkout: PlanWorkoutRef } = await req.json();
  const { weekIndex, workoutIndex, newWorkout } = body;

  const [planRecord] = await db
    .select({ plan: memberPlans.plan })
    .from(memberPlans)
    .where(eq(memberPlans.userId, me.id))
    .limit(1);
  if (!planRecord) return NextResponse.json({ error: "no_plan" }, { status: 404 });

  const plan = planRecord.plan as GeneratedPlan;
  if (!plan.weeks[weekIndex]?.workouts[workoutIndex]) {
    return NextResponse.json({ error: "invalid_indices" }, { status: 400 });
  }

  const updated: GeneratedPlan = JSON.parse(JSON.stringify(plan));
  updated.weeks[weekIndex].workouts[workoutIndex] = newWorkout;

  await db.update(memberPlans).set({ plan: updated }).where(eq(memberPlans.userId, me.id));

  return NextResponse.json({ ok: true });
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickWithFallback<T extends { intensity: string | null }>(
  pool: T[],
  targetIntensity: string | null,
  count: number
): T[] {
  const matching = targetIntensity ? pool.filter((w) => w.intensity === targetIntensity) : pool;
  const picks = matching.slice(0, count);
  if (picks.length < count) {
    const rest = pool.filter((w) => !picks.includes(w));
    picks.push(...rest.slice(0, count - picks.length));
  }
  return picks;
}
