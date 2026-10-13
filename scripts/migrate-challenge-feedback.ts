/** One-shot migration: create challenge_feedback. Idempotent. */
import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS challenge_feedback (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      challenge_member_id uuid NOT NULL REFERENCES challenge_members(id) ON DELETE CASCADE,
      rating integer NOT NULL,
      would_recommend boolean NOT NULL,
      favorite_part text,
      improvement text,
      will_review boolean NOT NULL DEFAULT false,
      submitted_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS challenge_feedback_member_uniq
      ON challenge_feedback (challenge_member_id);
  `);
  console.log("Migration applied: challenge_feedback ready.");
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
