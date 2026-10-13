import { config } from "dotenv";
config({ path: ".env.local" });
import { db, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

async function main() {
  // Find all beta testers (excluding Chrissy Geistel who has forever access)
  const betaTesters = await db
    .select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, freeAccessUntil: users.freeAccessUntil })
    .from(users)
    .where(eq(users.isBetaTester, true));

  console.log(`Found ${betaTesters.length} beta testers:\n`);
  betaTesters.forEach(u => {
    console.log(`  ${u.firstName} ${u.lastName} (${u.email}) — currently until: ${u.freeAccessUntil ?? "none"}`);
  });

  // Extend each one by 30 days from today (or from their current expiry, whichever is later)
  const updated = await db
    .update(users)
    .set({
      // If freeAccessUntil is in the future, add 30 days to it. If it's expired, add 30 days from now.
      freeAccessUntil: sql`GREATEST(COALESCE(${users.freeAccessUntil}, now()), now()) + interval '30 days'`,
      updatedAt: new Date(),
    })
    .where(eq(users.isBetaTester, true))
    .returning({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, freeAccessUntil: users.freeAccessUntil });

  console.log(`\n✅ Extended ${updated.length} beta testers by 30 days:\n`);
  updated.forEach(u => {
    console.log(`  ${u.firstName} ${u.lastName} (${u.email}) — now until: ${u.freeAccessUntil}`);
  });
}

main().catch(console.error).finally(() => process.exit(0));
