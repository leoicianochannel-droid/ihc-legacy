/** Quick read-only check of what's in the DB for the 30-day challenge. */
import { db, challenges, challengeDays, workouts } from "../lib/db";
import { eq, like } from "drizzle-orm";

async function main() {
  const [c] = await db.select().from(challenges).where(eq(challenges.slug, "30-day-challenge")).limit(1);
  console.log("Challenge row:", c ? `${c.title} (${c.id})` : "NONE");

  if (c) {
    const days = await db.select().from(challengeDays).where(eq(challengeDays.challengeId, c.id));
    console.log(`challenge_days rows: ${days.length}`);
    for (const d of days) {
      console.log(`  Day ${d.dayNumber}: workoutId=${d.workoutId ?? "(none)"}`);
    }
  }

  const w = await db.select().from(workouts).where(like(workouts.title, "30-Day Challenge%"));
  console.log(`30-Day workout rows: ${w.length}`);
  for (const x of w) console.log(`  ${x.title} (cf=${x.cfStreamUid?.slice(0, 8) ?? "(none)"})`);

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
