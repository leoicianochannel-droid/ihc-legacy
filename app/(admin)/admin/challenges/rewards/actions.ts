"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function assertAdmin() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("unauthenticated");
  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me || me.role !== "admin") throw new Error("forbidden");
}

export async function markRewardShipped(claimId: string) {
  await assertAdmin();
  await db.execute(sql`
    UPDATE challenge_reward_claims
    SET shipped_at = NOW()
    WHERE id = ${claimId}
  `);
  revalidatePath("/admin/challenges/rewards");
}

export async function updateRewardNotes(claimId: string, notes: string) {
  await assertAdmin();
  await db.execute(sql`
    UPDATE challenge_reward_claims
    SET admin_notes = ${notes}
    WHERE id = ${claimId}
  `);
  revalidatePath("/admin/challenges/rewards");
}
