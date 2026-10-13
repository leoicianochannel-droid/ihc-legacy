import { NextResponse } from "next/server";
import { db, workouts, challenges, challengeDays } from "@/lib/db";
import { eq, inArray, isNull, like } from "drizzle-orm";

// The 2 workouts that were already ready before launch day
const EARLY_READY = [
  { id: "ff23b5f6-88c7-4a5a-8a46-3b8b58e260c0", assetId: "JN8HjkHw1tfdDWwEqm2vi1Xa9EVgRgbff7ruByQU00pc" },
  { id: "23bb6ab6-014c-4011-827f-6b87911fdbc7", assetId: "ag0201qvim01Ysru00aouVMIBeHxdPjnGQkp01U94HMuPpLs" },
];

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.secret !== "ih21reset-launch") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (body.action === "lock") {
    // Hide the 2 early-ready videos until all 9 are done
    for (const w of EARLY_READY) {
      await db.update(workouts).set({ muxPlaybackId: null }).where(eq(workouts.id, w.id));
    }
    return NextResponse.json({ ok: true, message: "2 videos locked — all 9 will launch together." });
  }

  if (body.action === "launch") {
    // Re-query Mux for all 9 21DR videos and restore playback IDs
    const tokenId = process.env.MUX_TOKEN_ID;
    const tokenSecret = process.env.MUX_TOKEN_SECRET;
    if (!tokenId || !tokenSecret) return NextResponse.json({ error: "no mux creds" }, { status: 500 });
    const authHeader = "Basic " + Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64");

    const allDrWorkouts = await db
      .select({ id: workouts.id, title: workouts.title, muxAssetId: workouts.muxAssetId, muxPlaybackId: workouts.muxPlaybackId })
      .from(workouts)
      .where(like(workouts.title, "21 Day Reset%"));

    const results = [];
    for (const w of allDrWorkouts) {
      if (!w.muxAssetId) { results.push({ title: w.title, status: "no_asset_id" }); continue; }

      try {
        const res = await fetch(`https://api.mux.com/video/v1/assets/${w.muxAssetId}`, {
          headers: { Authorization: authHeader },
        });
        const json = await res.json() as { data?: { status?: string; playback_ids?: Array<{ id: string }> } };
        const status = json.data?.status;
        const playbackId = json.data?.playback_ids?.[0]?.id;

        if (status === "ready" && playbackId) {
          await db.update(workouts).set({ muxPlaybackId: playbackId }).where(eq(workouts.id, w.id));
          results.push({ title: w.title, status: "launched", playbackId });
        } else {
          results.push({ title: w.title, status: status ?? "not_ready" });
        }
      } catch (err) {
        results.push({ title: w.title, status: "error", error: String(err) });
      }
    }

    return NextResponse.json({ ok: true, results });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
