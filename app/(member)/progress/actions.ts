"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, progressEntries } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/streak";
import { todayInTz } from "@/lib/utils";

export async function saveEntry(input: {
  weightLb: number | null;
  mood: number | null;
  energyLevel: number | null;
  note: string | null;
  photoUrls?: string[];
  measurements?: { waist?: number; hips?: number; thigh?: number };
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("not authenticated");
  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) throw new Error("no user");

  const today = todayInTz(me.timezone ?? "America/New_York");

  const [existing] = await db
    .select()
    .from(progressEntries)
    .where(and(eq(progressEntries.userId, me.id), eq(progressEntries.entryDate, today)))
    .limit(1);

  const measurements =
    input.measurements && Object.values(input.measurements).some((v) => v != null)
      ? input.measurements
      : null;

  if (existing) {
    await db
      .update(progressEntries)
      .set({
        weightLb: input.weightLb,
        mood: input.mood,
        energyLevel: input.energyLevel,
        note: input.note,
        ...(measurements !== undefined && { measurements }),
        ...(input.photoUrls !== undefined && { photoUrls: input.photoUrls }),
      })
      .where(eq(progressEntries.id, existing.id));
  } else {
    await db.insert(progressEntries).values({
      userId: me.id,
      entryDate: today,
      weightLb: input.weightLb,
      mood: input.mood,
      energyLevel: input.energyLevel,
      note: input.note,
      measurements,
      photoUrls: input.photoUrls ?? [],
    });
  }

  await logActivity({
    userId: me.id,
    type: "daily_checkin",
    timezone: me.timezone ?? undefined,
  });

  revalidatePath("/progress");
  revalidatePath("/dashboard");
}
