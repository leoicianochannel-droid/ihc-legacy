"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, giftClaims } from "@/lib/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthenticated");
  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (me?.role !== "admin") throw new Error("Forbidden");
}

export async function markShipped(claimId: string) {
  await requireAdmin();
  await db
    .update(giftClaims)
    .set({ shippedAt: new Date() })
    .where(eq(giftClaims.id, claimId));
  revalidatePath("/admin/gifts/progress");
}
