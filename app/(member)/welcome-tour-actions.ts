"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function setStatus(field: "demoVideoWatchedAt" | "demoVideoSkippedAt") {
  const { userId: clerkId } = await auth();
  if (!clerkId) return;
  await db
    .update(users)
    .set({ [field]: new Date() })
    .where(eq(users.clerkId, clerkId));
  revalidatePath("/", "layout");
}

/** Called when the member closes the modal after watching the demo video. */
export async function markDemoVideoWatched() {
  await setStatus("demoVideoWatchedAt");
}

/** Called when they tap "Skip" — we won't show the modal again, but they
 * can still revisit it from the Welcome / Help page. */
export async function skipDemoVideo() {
  await setStatus("demoVideoSkippedAt");
}
