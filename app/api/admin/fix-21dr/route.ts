import { NextResponse } from "next/server";
import { db, challenges, challengeDays } from "@/lib/db";
import { eq, and } from "drizzle-orm";

// Workout IDs confirmed from DB
const WEEK1 = [
  "18939d54-0294-4549-925b-cf6c4ad808eb", // Week 1, Workout 1
  "df844e00-398e-4333-998b-bd1cb796c32f", // Week 1, Workout 2
  "182061e4-b55d-4831-a492-6b81d73bc5c9", // Week 1, Workout 3
];
const WEEK2 = [
  "45704542-7b99-47fa-9423-c053d1e50450", // Week 2, Workout 1
  "5d5ce522-69f7-472a-843a-c73cd7b2a4fb", // Week 2, Workout 2
  "ff23b5f6-88c7-4a5a-8a46-3b8b58e260c0", // Week 2, Workout 3
];
const WEEK3 = [
  "a5953f12-43da-4aba-9417-a3629a9104fb", // Week 3, Workout 1
  "23bb6ab6-014c-4011-827f-6b87911fdbc7", // Week 3, Workout 2
  "157a7d29-8548-4eb2-8b0c-43ba8732c500", // Week 3, Workout 3
];

function workoutForDay(dayNumber: number): string {
  if (dayNumber <= 7)  return WEEK1[(dayNumber - 1) % 3];
  if (dayNumber <= 14) return WEEK2[(dayNumber - 8) % 3];
  return WEEK3[(dayNumber - 15) % 3];
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.secret !== "ih21reset-fix-days") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [challenge] = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(eq(challenges.slug, "21-day-reset"))
    .limit(1);

  if (!challenge) return NextResponse.json({ error: "challenge not found" });

  const updated: number[] = [];
  for (let day = 1; day <= 21; day++) {
    const workoutId = workoutForDay(day);
    await db
      .update(challengeDays)
      .set({ workoutId })
      .where(and(eq(challengeDays.challengeId, challenge.id), eq(challengeDays.dayNumber, day)));
    updated.push(day);
  }

  return NextResponse.json({ ok: true, updated: updated.length, message: "All 21 days reassigned." });
}
