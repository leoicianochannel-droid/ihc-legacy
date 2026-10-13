/** Look up Ashley's user row to see what state it's in pre/post Clerk switch. */
import { db, users } from "../lib/db";
import { eq, sql } from "drizzle-orm";

async function main() {
  const email = "ashley@infinityhoop.com";
  const rows = await db
    .select({
      id: users.id,
      clerkId: users.clerkId,
      email: users.email,
      role: users.role,
      onboardedAt: users.onboardedAt,
      createdAt: users.createdAt,
      isBetaTester: users.isBetaTester,
    })
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`);

  console.log(`Found ${rows.length} row(s) for ${email}:\n`);
  for (const r of rows) {
    console.log(r);
  }
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
