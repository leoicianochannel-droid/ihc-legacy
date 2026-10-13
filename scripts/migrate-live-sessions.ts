/** Migration: create live_sessions for "currently hooping" presence. Idempotent. */
import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS live_sessions (
      user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      workout_id uuid REFERENCES workouts(id) ON DELETE SET NULL,
      started_at timestamptz NOT NULL DEFAULT now(),
      last_ping_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  console.log("Migration applied: live_sessions ready.");
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
