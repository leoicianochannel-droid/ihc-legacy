import { NextResponse } from "next/server";
import { db, workouts } from "@/lib/db";
import { eq } from "drizzle-orm";

// Maps workout labels to DB IDs for manual linking after dashboard upload
const WORKOUT_MAP: Record<string, string> = {
  "w1w1": "18939d54-0294-4549-925b-cf6c4ad808eb",
  "w1w2": "df844e00-398e-4333-998b-bd1cb796c32f",
  "w1w3": "182061e4-b55d-4831-a492-6b81d73bc5c9",
  "w2w1": "45704542-7b99-47fa-9423-c053d1e50450",
  "w2w2": "5d5ce522-69f7-472a-843a-c73cd7b2a4fb",
  "w2w3": "ff23b5f6-88c7-4a5a-8a46-3b8b58e260c0",
  "w3w1": "a5953f12-43da-4aba-9417-a3629a9104fb",
  "w3w2": "23bb6ab6-014c-4011-827f-6b87911fdbc7",
  "w3w3": "157a7d29-8548-4eb2-8b0c-43ba8732c500",
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.secret !== "ih21reset-link") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // body.links = [{ key: "w1w1", assetId: "...", playbackId: "..." }, ...]
  const links: Array<{ key: string; assetId: string; playbackId: string }> = body.links ?? [];
  if (!links.length) return NextResponse.json({ error: "no links provided" }, { status: 400 });

  const results = [];
  for (const link of links) {
    const workoutId = WORKOUT_MAP[link.key];
    if (!workoutId) { results.push({ key: link.key, status: "unknown_key" }); continue; }
    await db.update(workouts)
      .set({ muxAssetId: link.assetId, muxPlaybackId: link.playbackId })
      .where(eq(workouts.id, workoutId));
    results.push({ key: link.key, status: "linked", playbackId: link.playbackId });
  }

  return NextResponse.json({ ok: true, results });
}
