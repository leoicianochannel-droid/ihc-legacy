/**
 * Removes seed/demo workouts before importing real content.
 * Only deletes workouts that have no Mux playback (never uploaded).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { db, workouts } from "@/lib/db";
import { isNull } from "drizzle-orm";

async function main() {
  const res = await db
    .delete(workouts)
    .where(isNull(workouts.muxPlaybackId))
    .returning({ title: workouts.title });
  console.log(`Deleted ${res.length} workouts without videos (seed demos):`);
  for (const r of res) console.log(`  - ${r.title}`);
}

main().catch(console.error).finally(() => process.exit(0));
