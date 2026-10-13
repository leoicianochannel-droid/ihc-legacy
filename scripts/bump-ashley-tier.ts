/**
 * Manually bumps Ashley's tier to "champion" for testing.
 * Also records the tier_unlocks for mover + champion so the rewards page
 * shows them as unlocked with the discount codes revealed.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { db, users, tierUnlocks } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getTierStats } from "@/lib/tiers";

async function main() {
  const [me] = await db
    .select()
    .from(users)
    .where(eq(users.email, "ashley@infinityhoop.com"))
    .limit(1);

  if (!me) {
    console.error("❌ User ashley@infinityhoop.com not found in DB.");
    process.exit(1);
  }

  console.log(`Found user: ${me.firstName ?? me.email} (current tier: ${me.tier})`);

  const stats = await getTierStats(me.id);

  // Promote to champion
  await db
    .update(users)
    .set({ tier: "champion", tierUnlockedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, me.id));

  // Record tier unlocks for mover + champion (skipping starter, that's default)
  for (const tier of ["mover", "champion"] as const) {
    await db
      .insert(tierUnlocks)
      .values({
        userId: me.id,
        tier,
        workoutsAtUnlock: stats.workouts,
        streakAtUnlock: stats.longestStreak,
      })
      .onConflictDoNothing();
  }

  console.log("✅ Bumped to 🔥 Hoop Champion. Both Mover + Champion tiers now unlocked.");
  console.log("   Visit /rewards to see the unlocked discount codes.");
}

main().catch(console.error).finally(() => process.exit(0));
