import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.local.vercel" });

import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  await sql`
    CREATE TABLE IF NOT EXISTS challenge_submissions (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      challenge_id    uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category        text NOT NULL,
      title           text,
      story           text,
      photo_urls      text[],
      reel_url        text,
      reel_view_count integer,
      start_inches    real,
      end_inches      real,
      status          text NOT NULL DEFAULT 'submitted',
      submitted_at    timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS challenge_submission_unique
      ON challenge_submissions (challenge_id, user_id, category)
  `;

  console.log("✅ challenge_submissions table ready");
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
