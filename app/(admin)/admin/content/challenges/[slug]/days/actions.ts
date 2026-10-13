"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, challenges, challengeDays } from "@/lib/db";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";

async function assertAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("not authenticated");
  const [me] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (me?.role !== "admin") throw new Error("forbidden");
}

export async function saveChallengeAllDays(formData: FormData) {
  await assertAdmin();

  const challengeId = formData.get("challengeId") as string;

  const pairs: { dayNumber: number; workoutId: string | null }[] = [];
  for (const [key, val] of formData.entries()) {
    if (key.startsWith("day-")) {
      const dayNumber = parseInt(key.replace("day-", ""), 10);
      pairs.push({ dayNumber, workoutId: val === "" ? null : (val as string) });
    }
  }

  for (const { dayNumber, workoutId } of pairs) {
    await db
      .update(challengeDays)
      .set({ workoutId })
      .where(
        and(
          eq(challengeDays.challengeId, challengeId),
          eq(challengeDays.dayNumber, dayNumber)
        )
      );
  }

  revalidatePath("/admin/content");
  revalidatePath("/challenges");
}

export async function uploadChallengeCover(challengeSlug: string, formData: FormData) {
  await assertAdmin();
  const file = formData.get("cover") as File | null;
  if (!file || file.size === 0) throw new Error("No file provided");

  const ext = file.name.split(".").pop() ?? "jpg";
  const blob = await put(`challenges/${challengeSlug}/cover.${ext}`, file, {
    access: "public",
    contentType: file.type,
  });

  await db
    .update(challenges)
    .set({ coverUrl: blob.url })
    .where(eq(challenges.slug, challengeSlug));

  revalidatePath("/admin/content");
  revalidatePath("/challenges");
}

export async function updateChallengeStartsAt(challengeSlug: string, formData: FormData) {
  await assertAdmin();
  const raw = formData.get("startsAt") as string | null;
  const startsAt = raw ? new Date(raw) : null;
  await db
    .update(challenges)
    .set({ startsAt })
    .where(eq(challenges.slug, challengeSlug));
  revalidatePath("/admin/content");
  revalidatePath("/challenges");
}
