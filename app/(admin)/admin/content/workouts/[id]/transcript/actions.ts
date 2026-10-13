"use server";

import { db, workouts } from "@/lib/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  requestCaptions,
  fetchCaptionsVtt,
  parseVtt,
} from "@/lib/cloudflare-stream";

type Segment = { t: number; text: string };

export async function saveTranscript(
  workoutId: string,
  segments: Segment[]
): Promise<{ ok: boolean; error?: string }> {
  if (segments.length > 5000) return { ok: false, error: "Transcript too long (max 5000 segments)." };

  await db
    .update(workouts)
    .set({ transcript: segments.length > 0 ? segments : null })
    .where(eq(workouts.id, workoutId));

  revalidatePath(`/workouts`);
  revalidatePath(`/admin/content`);
  return { ok: true };
}

/**
 * Auto-generate a transcript from the Cloudflare Stream captions API.
 * Requests generation, polls up to 60s, then saves.
 */
export async function autoGenerateTranscript(workoutId: string): Promise<{
  ok: boolean;
  segments?: Segment[];
  error?: string;
  pending?: boolean;
}> {
  const [w] = await db
    .select({ cfStreamUid: workouts.cfStreamUid })
    .from(workouts)
    .where(eq(workouts.id, workoutId))
    .limit(1);

  if (!w?.cfStreamUid) {
    return { ok: false, error: "This workout has no Cloudflare Stream video attached." };
  }

  // Request generation (idempotent — safe to call multiple times)
  await requestCaptions(w.cfStreamUid);

  // Poll until captions are ready (up to ~45s in 3s intervals)
  const MAX_POLLS = 15;
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const vtt = await fetchCaptionsVtt(w.cfStreamUid);
    if (vtt) {
      const segments = parseVtt(vtt);
      if (segments.length > 0) {
        await db
          .update(workouts)
          .set({ transcript: segments })
          .where(eq(workouts.id, workoutId));
        revalidatePath(`/workouts`);
        revalidatePath(`/admin/content`);
        return { ok: true, segments };
      }
    }
  }

  // Still not ready — captions might take a few minutes for long videos
  return {
    ok: false,
    pending: true,
    error: "Captions are still processing — try again in a minute. Longer videos can take 2–3 minutes.",
  };
}
