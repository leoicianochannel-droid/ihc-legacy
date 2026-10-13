/**
 * One-shot migration: create challenge_resources table for downloadable
 * cheat sheets / trackers / guides attached to a challenge.
 * Idempotent — safe to re-run.
 */
import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS challenge_resources (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      title text NOT NULL,
      description text,
      file_url text NOT NULL,
      file_type text NOT NULL,
      file_name text NOT NULL,
      file_size integer NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS challenge_resources_challenge_idx
      ON challenge_resources (challenge_id);
  `);

  console.log("Migration applied: challenge_resources ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
