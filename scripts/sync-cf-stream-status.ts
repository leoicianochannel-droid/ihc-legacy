/**
 * Polls Cloudflare Stream for each workout's video status and updates the DB.
 * Run after bulk upload to fill in cfStreamStatus + cfCustomerCode for all
 * videos as they finish encoding.
 *
 * Usage:  npx tsx scripts/sync-cf-stream-status.ts
 *         npx tsx scripts/sync-cf-stream-status.ts --watch  (poll every 30s until all ready)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { db, workouts } from "@/lib/db";
import { eq, and, isNotNull, ne } from "drizzle-orm";
import { getVideo, customerCodeFromPlayback } from "@/lib/cloudflare-stream";

async function syncOnce(): Promise<{ updated: number; pending: number }> {
  // Find workouts with a CF UID that aren't yet "ready"
  const candidates = await db
    .select()
    .from(workouts)
    .where(and(isNotNull(workouts.cfStreamUid), ne(workouts.cfStreamStatus, "ready")));

  let updated = 0;
  let pending = 0;

  for (const w of candidates) {
    if (!w.cfStreamUid) continue;
    try {
      const v = await getVideo(w.cfStreamUid);
      if (!v) continue;
      const newStatus = v.status?.state ?? "unknown";
      const cc = customerCodeFromPlayback(v.playback?.hls);
      const newDuration = v.duration ? Math.max(1, Math.round(v.duration / 60)) : w.durationMin;

      const changed =
        newStatus !== w.cfStreamStatus ||
        cc !== w.cfCustomerCode ||
        newDuration !== w.durationMin;

      if (changed) {
        await db
          .update(workouts)
          .set({
            cfStreamStatus: newStatus,
            cfCustomerCode: cc,
            durationMin: newDuration,
          })
          .where(eq(workouts.id, w.id));
        updated++;
        console.log(`  ✓ ${w.title.padEnd(50)} → ${newStatus}  (${newDuration}m)`);
      }
      if (newStatus !== "ready") pending++;
    } catch (err) {
      console.error(`  ✗ ${w.title}: ${(err as Error).message}`);
    }
  }

  return { updated, pending };
}

async function main() {
  const watch = process.argv.includes("--watch");

  if (!watch) {
    const { updated, pending } = await syncOnce();
    console.log(`\nUpdated ${updated} workouts. ${pending} still encoding.`);
    return;
  }

  // Watch mode: poll every 30s until everything is "ready" (or 30 min elapsed)
  const start = Date.now();
  const maxMs = 30 * 60 * 1000;
  while (true) {
    console.log(`\n[${new Date().toISOString()}] Polling Cloudflare Stream...`);
    const { updated, pending } = await syncOnce();
    console.log(`  ${updated} updated, ${pending} still encoding`);
    if (pending === 0) {
      console.log("\n✅ All videos ready.");
      return;
    }
    if (Date.now() - start > maxMs) {
      console.log(`\n⏱ Timeout (${pending} still pending). Run again later to check.`);
      return;
    }
    await new Promise((r) => setTimeout(r, 30_000));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
