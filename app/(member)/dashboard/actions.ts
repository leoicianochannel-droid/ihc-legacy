"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, activityLog } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { logActivity } from "@/lib/streak";
import { todayInTz, getWeekStart } from "@/lib/utils";
import { revalidatePath } from "next/cache";

async function getMe() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;
  const [u] = await db
    .select({ id: users.id, timezone: users.timezone })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return u ?? null;
}

/** Log a daily check-in and bump the streak. */
export async function markDailyCheckIn() {
  const me = await getMe();
  if (!me) return { error: "not_authenticated" };

  const tz = me.timezone ?? "America/New_York";
  const today = todayInTz(tz);

  // Idempotent — don't double-log same day
  const [existing] = await db
    .select({ id: activityLog.id })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.userId, me.id),
        eq(activityLog.type, "daily_checkin"),
        sql`(${activityLog.createdAt} AT TIME ZONE ${tz})::date = ${today}::date`
      )
    )
    .limit(1);

  if (existing) return { ok: true, alreadyDone: true };

  const streak = await logActivity({
    userId: me.id,
    type: "daily_checkin",
    timezone: tz,
  });

  revalidatePath("/dashboard");
  return { ok: true, streak };
}

/** Save a recipe to this week's plan (one save per recipe per week). */
export async function saveRecipe(recipeId: string) {
  const me = await getMe();
  if (!me) return { error: "not_authenticated" };

  const tz = me.timezone ?? "America/New_York";

  // Already saved this week?
  const weekStart = getWeekStart(tz);
  const [existing] = await db
    .select({ id: activityLog.id })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.userId, me.id),
        eq(activityLog.type, "recipe_saved"),
        eq(activityLog.referenceId, recipeId),
        sql`(${activityLog.createdAt} AT TIME ZONE ${tz})::date >= ${weekStart}::date`
      )
    )
    .limit(1);

  if (existing) return { ok: true, alreadySaved: true };

  await logActivity({
    userId: me.id,
    type: "recipe_saved",
    referenceId: recipeId,
    timezone: tz,
  });

  revalidatePath("/dashboard");
  return { ok: true };
}

