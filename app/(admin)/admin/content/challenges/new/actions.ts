"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, challenges, challengeDays } from "@/lib/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function assertAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("not authenticated");
  const [me] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (me?.role !== "admin") throw new Error("forbidden");
}

export async function createChallenge(formData: FormData) {
  await assertAdmin();

  const title = (formData.get("title") as string).trim();
  const subtitle = (formData.get("subtitle") as string | null)?.trim() || null;
  const description = (formData.get("description") as string | null)?.trim() || null;
  const durationDays = parseInt(formData.get("durationDays") as string, 10);
  const isRolling = formData.get("isRolling") === "true";
  const startsAtRaw = formData.get("startsAt") as string | null;
  const startsAt = startsAtRaw ? new Date(startsAtRaw) : null;

  // Auto-generate slug from title
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  const [challenge] = await db
    .insert(challenges)
    .values({
      slug,
      title,
      subtitle,
      description,
      durationDays,
      isRolling,
      isActive: true,
      startsAt,
    })
    .returning({ id: challenges.id, slug: challenges.slug });

  // Pre-create empty day slots
  const days = Array.from({ length: durationDays }, (_, i) => ({
    challengeId: challenge.id,
    dayNumber: i + 1,
  }));
  if (days.length > 0) {
    await db.insert(challengeDays).values(days);
  }

  revalidatePath("/admin/content");
  redirect(`/admin/content/challenges/${challenge.slug}/days`);
}
