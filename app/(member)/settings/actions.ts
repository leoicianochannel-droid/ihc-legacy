"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateAvatar(url: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return;
  await db.update(users).set({ avatarUrl: url, updatedAt: new Date() }).where(eq(users.clerkId, clerkId));
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/community");
  revalidatePath("/profile");
}

export async function updateTimezone(timezone: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return;
  await db.update(users).set({ timezone }).where(eq(users.clerkId, clerkId));
  revalidatePath("/settings");
}

export async function updateReminderTime(time: string | null) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return;
  await db.update(users).set({ reminderTime: time }).where(eq(users.clerkId, clerkId));
  revalidatePath("/settings");
}
