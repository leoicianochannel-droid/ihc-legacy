/**
 * Marks all workouts that belong to the "2 Week Pre-Hoop" collection as
 * challengeOnly=true so they're hidden from the main /workouts list.
 * They'll only be accessed via /programs/2-week-pre-hoop.
 *
 * The "challengeOnly" flag is doing double-duty as "hide from main list."
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { db, workouts } from "@/lib/db";
import { eq } from "drizzle-orm";

async function main() {
  const res = await db
    .update(workouts)
    .set({ challengeOnly: true })
    .where(eq(workouts.collection, "2 Week Pre Hoop"))
    .returning({ title: workouts.title });

  console.log(`✅ Hidden ${res.length} Pre-Hoop workouts from /workouts list.`);
}

main().catch(console.error).finally(() => process.exit(0));
