"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, memberPlans } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function assertAdmin() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("not_authenticated");
  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (me?.role !== "admin") throw new Error("forbidden");
  return me;
}

/** Promote a member to admin or demote back to member. */
export async function setMemberRole(userId: string, role: "admin" | "member") {
  const me = await assertAdmin();
  // Don't allow an admin to demote themselves — would lock them out.
  if (userId === me.id && role !== "admin") {
    throw new Error("Can't demote yourself");
  }
  await db.update(users).set({ role }).where(eq(users.id, userId));
  revalidatePath("/admin/members");
}

/** Reset a member's progress back to Day 1. */
export async function resetMemberPlan(userId: string) {
  await assertAdmin();
  // Clear the plan row — they'll be sent back through plan-setup to generate a fresh plan
  await db.delete(memberPlans).where(eq(memberPlans.userId, userId));
  // Reset onboarding clock, plan gate, and milestone celebrations
  await db
    .update(users)
    .set({
      onboardedAt: sql`now()`,
      planCompletedAt: null,
      celebratedMilestones: sql`'{}'::integer[]`,
    })
    .where(eq(users.id, userId));
  revalidatePath("/admin/members");
  revalidatePath("/workouts");
}

/**
 * Toggle beta-tester status, granting 30 days of free access from now.
 * Idempotent — re-toggling resets the 30-day window.
 */
export async function toggleBetaTester(userId: string, makeBeta: boolean) {
  await assertAdmin();
  if (makeBeta) {
    await db
      .update(users)
      .set({
        isBetaTester: true,
        freeAccessUntil: sql`now() + interval '30 days'`,
      })
      .where(eq(users.id, userId));
  } else {
    await db
      .update(users)
      .set({ isBetaTester: false, freeAccessUntil: null })
      .where(eq(users.id, userId));
  }
  revalidatePath("/admin/members");
}
