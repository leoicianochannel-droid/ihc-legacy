"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function markMilestonesCelebrated(days: number[]) {
  if (!days.length) return;
  const { userId: clerkId } = await auth();
  if (!clerkId) return;

  const [me] = await db
    .select({ id: users.id, celebratedMilestones: users.celebratedMilestones })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  if (!me) return;

  const merged = [...new Set([...(me.celebratedMilestones ?? []), ...days])];
  await db.update(users).set({ celebratedMilestones: merged }).where(eq(users.id, me.id));
}
