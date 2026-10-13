"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Mark the welcome message as read & acknowledged. Called by the
 * first-login modal — once set, the modal never appears again for
 * this user.
 */
export async function acknowledgeWelcome() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return;

  await db
    .update(users)
    .set({ welcomeAcknowledgedAt: new Date() })
    .where(eq(users.clerkId, clerkId));

  revalidatePath("/", "layout");
}
