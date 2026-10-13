"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { sendPushToUser } from "@/lib/push";
import { createNotification } from "@/lib/notifications";

const MILESTONES: Record<number, { title: string; body: string }> = {
  7:  { title: "One week strong! 🔥", body: "You've completed 7 days of IH 75. The first week is the hardest — you're building real momentum now." },
  21: { title: "21 days in! 🏅", body: "Three weeks of IH 75 done. Science says this is where habits really start to stick — keep going!" },
  50: { title: "Day 50 — halfway and then some! 💪", body: "You've crossed the halfway mark on IH 75. 25 days left to finish what you started." },
  75: { title: "IH 75 COMPLETE! 🏆", body: "You did it! All 75 days of IH 75 — you should be incredibly proud. You are unstoppable." },
};

async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ih75_enrollments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      started_at DATE NOT NULL DEFAULT CURRENT_DATE,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ih75_checkins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day_number INTEGER NOT NULL,
      checkin_date DATE NOT NULL,
      tasks JSONB NOT NULL DEFAULT '{}',
      all_done BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, day_number)
    )
  `);
}

async function requireMe() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) redirect("/onboarding");
  return me;
}

export async function enrollInIH75() {
  const me = await requireMe();
  await ensureTables();
  await db.execute(sql`
    INSERT INTO ih75_enrollments (user_id) VALUES (${me.id})
    ON CONFLICT (user_id) DO NOTHING
  `);
  revalidatePath("/workouts/75");
}

export async function saveCheckin(dayNumber: number, tasks: Record<string, boolean>) {
  const me = await requireMe();
  await ensureTables();
  const allDone = Object.values(tasks).length === 5 && Object.values(tasks).every(Boolean);

  // Check if this day was previously all-done (so we don't re-fire milestone)
  const prev = await db.execute<{ all_done: boolean }>(sql`
    SELECT all_done FROM ih75_checkins WHERE user_id = ${me.id} AND day_number = ${dayNumber} LIMIT 1
  `);
  const wasAlreadyDone = (prev as unknown as Array<{ all_done: boolean }>)[0]?.all_done ?? false;

  await db.execute(sql`
    INSERT INTO ih75_checkins (user_id, day_number, checkin_date, tasks, all_done)
    VALUES (${me.id}, ${dayNumber}, CURRENT_DATE, ${JSON.stringify(tasks)}::jsonb, ${allDone})
    ON CONFLICT (user_id, day_number)
    DO UPDATE SET tasks = ${JSON.stringify(tasks)}::jsonb, all_done = ${allDone}
  `);

  // Fire milestone notification once, when this day is newly completed
  if (allDone && !wasAlreadyDone && MILESTONES[dayNumber]) {
    const { title, body } = MILESTONES[dayNumber];
    await Promise.allSettled([
      createNotification(me.id, { type: "milestone_reached", title, body, actionUrl: "/workouts/75" }),
      sendPushToUser(me.id, { title, body, url: "/workouts/75" }),
    ]);
  }

  revalidatePath("/workouts/75");
  return { ok: true };
}

export type IH75Data = {
  enrollment: { startedAt: string; status: string } | null;
  checkins: Array<{ dayNumber: number; tasks: Record<string, boolean>; allDone: boolean }>;
  currentDay: number;
  todayCheckin: { tasks: Record<string, boolean>; allDone: boolean } | null;
};

export async function sendIH75Reminder() {
  const me = await requireMe();
  await ensureTables();

  const enrollRows = await db.execute<{ started_at: string; status: string }>(sql`
    SELECT started_at::text, status FROM ih75_enrollments WHERE user_id = ${me.id} LIMIT 1
  `);
  const enrollment = (enrollRows as unknown as Array<{ started_at: string; status: string }>)[0];
  if (!enrollment || enrollment.status !== "active") return { error: "not_enrolled" };

  const daysSinceStart = Math.floor(
    (Date.now() - new Date(enrollment.started_at + "T00:00:00Z").getTime()) / (1000 * 60 * 60 * 24)
  );
  const currentDay = Math.min(daysSinceStart + 1, 75);

  const checkinRows = await db.execute<{ day_number: number }>(sql`
    SELECT day_number FROM ih75_checkins WHERE user_id = ${me.id} AND day_number = ${currentDay} LIMIT 1
  `);
  const alreadyDone = (checkinRows as unknown as Array<{ day_number: number }>).length > 0;
  if (alreadyDone) return { error: "already_checked_in" };

  await sendPushToUser(me.id, {
    title: "IH 75 — Day " + currentDay,
    body: "Don't forget your check-in today! You're on Day " + currentDay + " of 75. Keep the streak alive 🔥",
    url: "/workouts/75",
  });

  return { ok: true };
}

export async function getIH75Data(): Promise<IH75Data> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { enrollment: null, checkins: [], currentDay: 0, todayCheckin: null };

  const [me] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return { enrollment: null, checkins: [], currentDay: 0, todayCheckin: null };

  try {
    await ensureTables();

    const enrollRows = await db.execute<{ started_at: string; status: string }>(sql`
      SELECT started_at::text, status FROM ih75_enrollments WHERE user_id = ${me.id} LIMIT 1
    `);
    const enrollArr = enrollRows as unknown as Array<{ started_at: string; status: string }>;
    const enrollment = enrollArr[0] ?? null;

    if (!enrollment) return { enrollment: null, checkins: [], currentDay: 0, todayCheckin: null };

    const daysSinceStart = Math.floor(
      (Date.now() - new Date(enrollment.started_at + "T00:00:00Z").getTime()) / (1000 * 60 * 60 * 24)
    );
    const currentDay = Math.min(daysSinceStart + 1, 75);

    const checkinRows = await db.execute<{ day_number: number; tasks: Record<string, boolean>; all_done: boolean }>(sql`
      SELECT day_number, tasks, all_done FROM ih75_checkins WHERE user_id = ${me.id} ORDER BY day_number
    `);
    const checkins = (checkinRows as unknown as Array<{ day_number: number; tasks: Record<string, boolean>; all_done: boolean }>)
      .map((r) => ({ dayNumber: r.day_number, tasks: r.tasks ?? {}, allDone: r.all_done }));

    const todayCheckin = checkins.find((c) => c.dayNumber === currentDay) ?? null;

    return { enrollment: { startedAt: enrollment.started_at, status: enrollment.status }, checkins, currentDay, todayCheckin };
  } catch {
    return { enrollment: null, checkins: [], currentDay: 0, todayCheckin: null };
  }
}
