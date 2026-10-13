"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, workouts, recipes, challenges } from "@/lib/db";
import { eq } from "drizzle-orm";
import { mux } from "@/lib/mux";
import { revalidatePath } from "next/cache";

async function assertAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("not authenticated");
  const [me] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (me?.role !== "admin") throw new Error("forbidden");
  return me;
}

/**
 * Deletes a workout. If it has a real Mux asset (not just an upload id),
 * also deletes the Mux asset to free up storage.
 */
export async function deleteWorkout(workoutId: string) {
  await assertAdmin();

  const [w] = await db.select().from(workouts).where(eq(workouts.id, workoutId)).limit(1);
  if (!w) return;

  // Only try to delete the Mux asset if it looks like a real asset id
  // (upload ids and asset ids have different formats). We treat presence of
  // muxPlaybackId as the signal that the asset is fully ingested.
  if (w.muxAssetId && w.muxPlaybackId) {
    try {
      await mux.video.assets.delete(w.muxAssetId);
    } catch (err) {
      // Non-fatal — the asset might already be gone or the token might
      // lack permissions. Log and keep going.
      console.warn("Could not delete Mux asset", w.muxAssetId, err);
    }
  }

  await db.delete(workouts).where(eq(workouts.id, workoutId));

  revalidatePath("/admin/content");
  revalidatePath("/workouts");
}

export async function deleteRecipe(recipeId: string) {
  await assertAdmin();
  await db.delete(recipes).where(eq(recipes.id, recipeId));
  revalidatePath("/admin/content");
  revalidatePath("/recipes");
}

export async function deleteChallenge(challengeId: string) {
  await assertAdmin();
  await db.delete(challenges).where(eq(challenges.id, challengeId));
  revalidatePath("/admin/content");
  revalidatePath("/challenges");
}

export async function setWorkoutUnlockDay(workoutId: string, formData: FormData) {
  await assertAdmin();
  const raw = formData.get("day");
  const day = raw === "" || raw === null ? null : Number(raw);
  await db
    .update(workouts)
    .set({ unlocksAtDay: day })
    .where(eq(workouts.id, workoutId));
  revalidatePath("/admin/content");
  revalidatePath("/workouts");
}

export async function toggleChallengeOnly(workoutId: string, value: boolean) {
  await assertAdmin();
  await db
    .update(workouts)
    .set({ challengeOnly: value })
    .where(eq(workouts.id, workoutId));
  revalidatePath("/admin/content");
  revalidatePath("/workouts");
}
