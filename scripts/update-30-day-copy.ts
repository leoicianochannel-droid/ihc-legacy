/** Patch the 30-day challenge subtitle + description to match the day-based framing. */
import { db, challenges } from "../lib/db";
import { eq } from "drizzle-orm";

async function main() {
  const result = await db
    .update(challenges)
    .set({
      subtitle: "30 videos for 30 days. Each day unlocks after the one before it.",
      description:
        "A daily 30-minute hooping practice designed for beginners. Day 1 is unlocked the moment you join — every day after that opens once you finish the previous workout. Miss a day? Your freeze tokens kick in automatically to keep your streak alive.",
    })
    .where(eq(challenges.slug, "30-day-challenge"))
    .returning({ slug: challenges.slug, subtitle: challenges.subtitle });

  console.log("✓ Updated:", result);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
