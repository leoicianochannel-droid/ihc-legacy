"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, giftMilestones } from "@/lib/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { GIFT_MILESTONES } from "@/lib/gifts";

async function requireAdmin() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthenticated");
  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (me?.role !== "admin") throw new Error("Forbidden");
}

export type MilestoneFormData = {
  key: string;
  dayThreshold: number;
  label: string;
  fullLabel: string;
  description: string;
  emoji: string;
  retailValue: string;
  requiresShipping: boolean;
  imageUrl: string | null;
  isActive: boolean;
};

export async function saveMilestone(id: string | null, data: MilestoneFormData) {
  await requireAdmin();

  if (id) {
    await db
      .update(giftMilestones)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(giftMilestones.id, id));
  } else {
    await db.insert(giftMilestones).values({
      ...data,
      imageUrl: data.imageUrl || null,
    });
  }

  revalidatePath("/admin/gifts");
  revalidatePath("/gifts");
  revalidatePath("/");
}

export async function deleteMilestone(id: string) {
  await requireAdmin();
  await db.delete(giftMilestones).where(eq(giftMilestones.id, id));
  revalidatePath("/admin/gifts");
  revalidatePath("/gifts");
  revalidatePath("/");
}

export async function seedDefaultMilestones() {
  await requireAdmin();

  for (const m of GIFT_MILESTONES) {
    await db
      .insert(giftMilestones)
      .values({
        key: m.key,
        dayThreshold: m.dayThreshold,
        label: m.label,
        fullLabel: m.fullLabel,
        description: m.description,
        emoji: m.emoji,
        retailValue: m.retailValue,
        requiresShipping: m.requiresShipping,
        imageUrl: m.image,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  revalidatePath("/admin/gifts");
}
