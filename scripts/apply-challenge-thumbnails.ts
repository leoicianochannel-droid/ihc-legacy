import { config } from "dotenv";
config({ path: ".env.local" });
import { db, programs, challenges } from "@/lib/db";
import { eq } from "drizzle-orm";

async function main() {
  // Show current state
  const ps = await db.select({ slug: programs.slug, title: programs.title }).from(programs);
  const cs = await db.select({ slug: challenges.slug, title: challenges.title }).from(challenges);
  console.log("Programs:", ps.map(p => `${p.slug} | ${p.title}`));
  console.log("Challenges:", cs.map(c => `${c.slug} | ${c.title}`));

  // Update 2 Week Pre-Hoop program
  const preHoop = await db
    .update(programs)
    .set({ coverUrl: "/thumbnails/Pre Hoop Two Week Challenge.jpeg" })
    .where(eq(programs.slug, "2-week-pre-hoop"))
    .returning({ slug: programs.slug });
  console.log("\nPre-Hoop program:", preHoop.length ? `✓ Updated` : "✗ Not found — check slug above");

  // Update 45-day challenge
  const c45 = await db
    .update(challenges)
    .set({ coverUrl: "/thumbnails/45 Day Challenge.jpg" })
    .where(eq(challenges.slug, "45-day-challenge"))
    .returning({ slug: challenges.slug });
  console.log("45-Day challenge:", c45.length ? `✓ Updated` : "✗ Not found — check slug above");

  // Update 30-day challenge
  const c30 = await db
    .update(challenges)
    .set({ coverUrl: "/thumbnails/30 Day Challenge.jpeg" })
    .where(eq(challenges.slug, "30-day-challenge"))
    .returning({ slug: challenges.slug });
  console.log("30-Day challenge:", c30.length ? `✓ Updated` : "✗ Not found — check slug above");
}

main().catch(console.error).finally(() => process.exit(0));
