"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, streaks, activityLog } from "@/lib/db";
import { eq, and, count } from "drizzle-orm";

export type RetentionStats = {
  firstName: string | null;
  memberSince: string; // formatted
  daysAsMember: number;
  workoutsCompleted: number;
  currentStreak: number;
  longestStreak: number;
};

export async function getRetentionStats(): Promise<RetentionStats | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const [me] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  if (!me) return null;

  const [streak] = await db
    .select()
    .from(streaks)
    .where(eq(streaks.userId, me.id))
    .limit(1);

  const [{ workoutCount }] = await db
    .select({ workoutCount: count() })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.userId, me.id),
        eq(activityLog.type, "workout_completed")
      )
    );

  const joinedDate = me.createdAt ?? new Date();
  const daysAsMember = Math.floor(
    (Date.now() - new Date(joinedDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  const memberSince = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(joinedDate));

  return {
    firstName: me.firstName,
    memberSince,
    daysAsMember,
    workoutsCompleted: Number(workoutCount),
    currentStreak: streak?.current ?? 0,
    longestStreak: streak?.longest ?? 0,
  };
}
