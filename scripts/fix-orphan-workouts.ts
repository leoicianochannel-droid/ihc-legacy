/**
 * Recovery: find workouts with no muxAssetId but created recently,
 * pull the most recent ready asset from Mux, and link it.
 *
 * One-off fix for workouts uploaded before the action bug was patched.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { db, workouts } from "@/lib/db";
import { eq, isNull, desc, and, gte } from "drizzle-orm";
import { mux } from "@/lib/mux";

async function main() {
  // Find workouts without any Mux IDs, created in the last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const orphans = await db
    .select()
    .from(workouts)
    .where(
      and(
        isNull(workouts.muxAssetId),
        gte(workouts.createdAt, oneDayAgo)
      )
    )
    .orderBy(desc(workouts.createdAt));

  console.log(`Found ${orphans.length} orphan workout(s):`, orphans.map((w) => w.title));
  if (orphans.length === 0) return;

  // List recent Mux assets (most recent first)
  const assetsPage = await mux.video.assets.list({ limit: 20 });
  const readyAssets = assetsPage.data.filter((a) => a.status === "ready");
  console.log(`\nFound ${readyAssets.length} ready asset(s) in Mux`);

  if (readyAssets.length === 0) {
    console.log("No ready assets yet — try again in a minute.");
    return;
  }

  // Link the oldest orphan to the oldest ready asset (FIFO)
  const sortedAssets = [...readyAssets].sort(
    (a, b) => Number(a.created_at) - Number(b.created_at)
  );
  const sortedOrphans = [...orphans].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  for (let i = 0; i < Math.min(sortedOrphans.length, sortedAssets.length); i++) {
    const orphan = sortedOrphans[i];
    const asset = sortedAssets[i];
    const playbackId = asset.playback_ids?.[0]?.id;
    if (!playbackId) {
      console.log(`Asset ${asset.id} has no playback id, skipping`);
      continue;
    }
    await db
      .update(workouts)
      .set({ muxAssetId: asset.id, muxPlaybackId: playbackId })
      .where(eq(workouts.id, orphan.id));
    console.log(`✓ Linked "${orphan.title}" → asset ${asset.id.slice(0, 12)}…`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
