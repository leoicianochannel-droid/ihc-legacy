import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users, activityLog } from "@/lib/db";
import { and, eq, sql } from "drizzle-orm";

const BONUS_WORKOUTS = 10;
const BONUS_SOURCE = "founding_member_bonus";

export async function POST() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // All onboarded founding members
  const founders = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.migratedFromSkool, true), sql`${users.onboardedAt} IS NOT NULL`));

  // Which ones already got the bonus?
  const alreadyBonused = await db
    .select({ userId: activityLog.userId })
    .from(activityLog)
    .where(sql`${activityLog.meta}->>'source' = ${BONUS_SOURCE}`);
  const bonusedIds = new Set(alreadyBonused.map((r) => r.userId));

  const eligible = founders.filter((f) => !bonusedIds.has(f.id));
  if (eligible.length === 0) {
    return NextResponse.json({ ok: true, credited: 0, message: "All founding members already have their bonus." });
  }

  // Insert 10 workout_completed entries per eligible founder
  const rows = eligible.flatMap((f) =>
    Array.from({ length: BONUS_WORKOUTS }, () => ({
      userId: f.id,
      type: "workout_completed" as const,
      meta: { source: BONUS_SOURCE },
    }))
  );

  await db.insert(activityLog).values(rows);

  return NextResponse.json({ ok: true, credited: eligible.length, bonusWorkouts: BONUS_WORKOUTS });
}
