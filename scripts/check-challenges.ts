import { config } from "dotenv";
config({ path: ".env.local" });
import { db, challenges, challengeDays, workouts } from "@/lib/db";
import { eq, asc } from "drizzle-orm";

async function main() {
  const all = await db.select().from(challenges);
  console.log(`Found ${all.length} challenges\n`);
  for (const c of all) {
    console.log(`${c.title}  [slug: ${c.slug}]`);
    console.log(`  active: ${c.isActive} · duration: ${c.durationDays} days`);

    const days = await db
      .select()
      .from(challengeDays)
      .where(eq(challengeDays.challengeId, c.id))
      .orderBy(asc(challengeDays.dayNumber));

    console.log(`  ${days.length} days/weeks:`);
    for (const d of days) {
      let workoutTitle = "—";
      if (d.workoutId) {
        const [w] = await db.select().from(workouts).where(eq(workouts.id, d.workoutId)).limit(1);
        workoutTitle = w
          ? `${w.title} (${w.cfStreamStatus ?? "?"})`
          : "MISSING WORKOUT";
      }
      console.log(`    Day ${d.dayNumber}: ${d.title ?? "—"} → ${workoutTitle}`);
    }
    console.log();
  }
}

main().catch(console.error).finally(() => process.exit(0));
