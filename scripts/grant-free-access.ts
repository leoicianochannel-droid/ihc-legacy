import { config } from "dotenv";
config({ path: ".env.local" });
import { db, users } from "@/lib/db";
import { ilike, or, eq } from "drizzle-orm";

async function main() {
  // Find Chrissy Geistel
  const matches = await db
    .select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, isBetaTester: users.isBetaTester, freeAccessUntil: users.freeAccessUntil })
    .from(users)
    .where(or(ilike(users.firstName, "%chrissy%"), ilike(users.lastName, "%geistel%"), ilike(users.email, "%geistel%")));

  console.log("Found:", JSON.stringify(matches, null, 2));

  if (matches.length === 0) {
    console.log("No match found — check spelling.");
    return;
  }

  // If multiple matches, target by known ID
  const user = matches.find(u => u.id === "ccbe56f1-6ad0-4807-9d27-cc5f3c1c8396") ?? matches[0];
  // Set free access until year 2099 — effectively forever
  await db
    .update(users)
    .set({
      isBetaTester: true,
      freeAccessUntil: new Date("2099-01-01T00:00:00Z"),
      betaNote: "Free access forever — granted by Ashley",
    })
    .where(eq(users.id, user.id));

  console.log(`\n✅ Done! ${user.firstName} ${user.lastName} (${user.email}) now has free access until 2099.`);
}

main().catch(console.error).finally(() => process.exit(0));
