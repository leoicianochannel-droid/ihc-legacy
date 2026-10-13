import { NextResponse } from "next/server";
import { db, workouts, challenges, challengeDays } from "@/lib/db";
import { eq, inArray, like } from "drizzle-orm";

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== "ih21reset-check") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const [challenge] = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(eq(challenges.slug, "21-day-reset"))
    .limit(1);

  if (!challenge) return NextResponse.json({ error: "challenge not found" });

  const days = await db
    .select({ workoutId: challengeDays.workoutId })
    .from(challengeDays)
    .where(eq(challengeDays.challengeId, challenge.id));

  const workoutIds = [...new Set(days.map((d) => d.workoutId).filter((id): id is string => !!id))];

  const ws = workoutIds.length
    ? await db
        .select({ id: workouts.id, title: workouts.title, muxPlaybackId: workouts.muxPlaybackId, muxAssetId: workouts.muxAssetId })
        .from(workouts)
        .where(inArray(workouts.id, workoutIds))
    : [];

  const ready = ws.filter((w) => w.muxPlaybackId);
  const pending = ws.filter((w) => !w.muxPlaybackId);

  // Also fetch all 9 21DR workouts by title pattern to see full Mux status
  const allDrWorkouts = await db
    .select({ id: workouts.id, title: workouts.title, muxAssetId: workouts.muxAssetId, muxPlaybackId: workouts.muxPlaybackId })
    .from(workouts)
    .where(like(workouts.title, "21 Day Reset%"));

  const assignedDays = days.filter((d) => d.workoutId).length;
  const unassignedDays = days.filter((d) => !d.workoutId).length;

  // Check Mux asset status for the 7 not-yet-ready ones
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  const muxStatuses: Record<string, string> = {};
  if (tokenId && tokenSecret) {
    const authHeader = "Basic " + Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64");
    await Promise.all(
      allDrWorkouts
        .filter((w) => !w.muxPlaybackId && w.muxAssetId)
        .map(async (w) => {
          try {
            // These IDs are upload IDs (stashed before webhook) — query the uploads endpoint
            const res = await fetch(`https://api.mux.com/video/v1/uploads/${w.muxAssetId}`, {
              headers: { Authorization: authHeader },
            });
            const json = await res.json() as { data?: { status?: string; asset_id?: string } };
            const uploadStatus = json.data?.status ?? `http${res.status}`;
            const linkedAssetId = json.data?.asset_id;
            muxStatuses[w.title] = linkedAssetId
              ? `upload:${uploadStatus} → asset:${linkedAssetId}`
              : `upload:${uploadStatus}`;
          } catch {
            muxStatuses[w.title] = "fetch_error";
          }
        })
    );
  }

  return NextResponse.json({
    totalDays: days.length,
    assignedDays,
    unassignedDays,
    uniqueWorkoutsLinked: workoutIds.length,
    allDrWorkouts: allDrWorkouts.sort((a, b) => a.title.localeCompare(b.title)).map(w => ({
      title: w.title,
      muxReady: !!w.muxPlaybackId,
      muxAssetId: w.muxAssetId,
      muxStatus: muxStatuses[w.title] ?? (w.muxPlaybackId ? "ready" : "n/a"),
    })),
  });
}
