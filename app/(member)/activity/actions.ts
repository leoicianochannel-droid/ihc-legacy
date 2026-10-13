"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, users, personalWorkouts } from "@/lib/db";
import { eq, desc, sql } from "drizzle-orm";
import { logActivity } from "@/lib/streak";

async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS personal_workouts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      activity_type TEXT NOT NULL,
      title TEXT,
      duration_min INTEGER NOT NULL,
      notes TEXT,
      logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function logPersonalWorkout(_prevState: unknown, formData: FormData) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const [me] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) redirect("/onboarding");

  const activityType = String(formData.get("activityType") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  const durationMin = parseInt(String(formData.get("durationMin") ?? "0"), 10);
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const loggedDateRaw = String(formData.get("loggedDate") ?? "").trim();
  const loggedAt = loggedDateRaw ? new Date(loggedDateRaw + "T12:00:00Z") : new Date();

  if (!activityType || isNaN(durationMin) || durationMin < 1) {
    return { error: "Please choose an activity type and duration." };
  }
  const endOfToday = new Date();
  endOfToday.setUTCHours(23, 59, 59, 999);
  if (loggedAt > endOfToday) {
    return { error: "You can't log a workout in the future." };
  }

  await ensureTable();

  const [entry] = await db
    .insert(personalWorkouts)
    .values({ userId: me.id, activityType, title, durationMin, notes, loggedAt })
    .returning({ id: personalWorkouts.id });

  await logActivity({
    userId: me.id,
    type: "workout_completed",
    referenceId: entry.id,
    meta: { source: "personal", activityType, title, durationMin },
  });

  revalidatePath("/activity");
  revalidatePath("/progress");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deletePersonalWorkout(id: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return;

  const [me] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return;

  await ensureTable();
  const [entry] = await db
    .select({ userId: personalWorkouts.userId })
    .from(personalWorkouts)
    .where(eq(personalWorkouts.id, id))
    .limit(1);
  if (!entry || entry.userId !== me.id) return;

  await db.execute(sql`DELETE FROM personal_workouts WHERE id = ${id}`);
  revalidatePath("/activity");
  revalidatePath("/dashboard");
}

export async function getWorkoutHistory(userId: string) {
  await ensureTable();
  return db
    .select()
    .from(personalWorkouts)
    .where(eq(personalWorkouts.userId, userId))
    .orderBy(desc(personalWorkouts.createdAt))
    .limit(30)
    .catch(() => []);
}
