"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function assertAdmin() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("not authenticated");
  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (me?.role !== "admin") throw new Error("forbidden");
}

export async function markUserAsBetaTester(input: {
  email: string;
  expiresOn: string;             // YYYY-MM-DD
  note?: string;
}): Promise<{ ok: boolean; msg: string }> {
  await assertAdmin();

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (!target) {
    return {
      ok: false,
      msg: `No member found with email "${input.email}". Have them sign up first, then grant access here.`,
    };
  }

  // Parse the date string as end-of-day in UTC so they get the full final day
  const expiry = new Date(`${input.expiresOn}T23:59:59Z`);
  if (isNaN(expiry.getTime())) {
    return { ok: false, msg: "Invalid expiration date." };
  }

  await db
    .update(users)
    .set({
      isBetaTester: true,
      freeAccessUntil: expiry,
      betaNote: input.note?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, target.id));

  revalidatePath("/admin/beta");

  const formatted = expiry.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return {
    ok: true,
    msg: `✓ ${target.firstName ?? input.email} has free access through ${formatted}.`,
  };
}

export async function setUserBetaStatus(userId: string, isBeta: boolean) {
  await assertAdmin();
  await db
    .update(users)
    .set({
      isBetaTester: isBeta,
      freeAccessUntil: isBeta ? undefined : null, // revoke ends free access
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  revalidatePath("/admin/beta");
}

export async function extendFreeAccess(userId: string, newExpiresOn: string) {
  await assertAdmin();
  const expiry = new Date(`${newExpiresOn}T23:59:59Z`);
  await db
    .update(users)
    .set({ freeAccessUntil: expiry, updatedAt: new Date() })
    .where(eq(users.id, userId));
  revalidatePath("/admin/beta");
}
