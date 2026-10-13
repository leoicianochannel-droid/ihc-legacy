"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { setWelcomeVideo, clearWelcomeVideo } from "@/lib/welcome-video";
import { customerCodeFromPlayback, getVideo } from "@/lib/cloudflare-stream";

async function assertAdmin() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("not_authenticated");
  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (me?.role !== "admin") throw new Error("forbidden");
}

/**
 * Save a welcome video. Accepts either:
 *   - a Cloudflare Stream UID directly
 *   - a Cloudflare iframe / playback URL we can parse a UID out of
 *
 * If we can talk to the Stream API, we'll also fetch the customer subdomain
 * and duration to enrich the saved record.
 */
export async function saveWelcomeVideo(formData: FormData) {
  await assertAdmin();
  const raw = String(formData.get("input") ?? "").trim();
  if (!raw) throw new Error("missing input");

  // Extract uid if a URL was pasted
  const uidMatch = raw.match(/(?:cloudflarestream\.com|videodelivery\.net)\/([a-f0-9]{32})/i);
  const uid = uidMatch ? uidMatch[1] : raw;
  if (!/^[a-f0-9]{32}$/i.test(uid)) {
    throw new Error("That doesn't look like a Cloudflare Stream UID or playback URL.");
  }

  // Best-effort enrichment: fetch metadata from Stream API
  let customerCode: string | null = null;
  let durationSec: number | null = null;
  try {
    const video = await getVideo(uid);
    if (video?.playback?.hls) {
      customerCode = customerCodeFromPlayback(video.playback.hls);
    }
    if (typeof video?.duration === "number" && video.duration > 0) {
      durationSec = Math.round(video.duration);
    }
  } catch (err) {
    // If we can't reach the API, just save the UID — the iframe URL falls
    // back to the generic videodelivery.net domain which still works.
    console.warn("Could not enrich welcome video metadata:", err);
  }

  await setWelcomeVideo({ uid, customerCode, durationSec });
  revalidatePath("/admin/welcome-video");
  revalidatePath("/", "layout");
}

export async function removeWelcomeVideo() {
  await assertAdmin();
  await clearWelcomeVideo();
  revalidatePath("/admin/welcome-video");
  revalidatePath("/", "layout");
}
