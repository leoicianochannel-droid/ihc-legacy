"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, workouts } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createDirectUpload } from "@/lib/mux";
import { slugify } from "@/lib/utils";
import { revalidatePath } from "next/cache";

async function assertAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("not authenticated");
  const [me] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (me?.role !== "admin") throw new Error("forbidden");
  return me;
}

export async function getMuxDirectUpload() {
  await assertAdmin();
  const upload = await createDirectUpload({});
  return { url: upload.url, uploadId: upload.id };
}

export async function createWorkout(input: {
  title: string;
  description: string;
  instructor: string;
  durationMin: number;
  intensity: "beginner" | "intermediate" | "advanced";
  bodyFocus: string[];
  muxUploadId: string;
}) {
  await assertAdmin();

  const slug = slugify(input.title) + "-" + Math.random().toString(36).slice(2, 6);

  await db.insert(workouts).values({
    slug,
    title: input.title,
    description: input.description,
    instructor: input.instructor,
    durationMin: input.durationMin,
    intensity: input.intensity,
    bodyFocus: input.bodyFocus,
    equipment: ["hoop"],
    usesHoop: true,
    // Store the Mux upload id as the asset id temporarily — the Mux webhook
    // will swap it out for the real asset id + playback id once encoding
    // completes (~30–60 seconds after upload).
    muxAssetId: input.muxUploadId,
    muxPlaybackId: null,
    publishedAt: new Date(),
  });

  revalidatePath("/admin/content");
  revalidatePath("/workouts");
}
