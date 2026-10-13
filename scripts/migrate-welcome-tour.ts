/** Add welcome tour fields + site_settings table. Idempotent. */
import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS demo_video_watched_at timestamptz,
      ADD COLUMN IF NOT EXISTS demo_video_skipped_at timestamptz;
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS site_settings (
      key varchar(100) PRIMARY KEY,
      value text,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  console.log("Migration applied: welcome tour + site_settings.");
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
