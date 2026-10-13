/** Add welcome_acknowledged_at column to users. Idempotent. */
import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS welcome_acknowledged_at timestamptz;
  `);
  console.log("Migration applied: users.welcome_acknowledged_at ready.");
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
