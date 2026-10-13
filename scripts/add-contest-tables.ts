import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.local.vercel" });

import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  await sql`
    CREATE TABLE IF NOT EXISTS contest_enrollments (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      challenge_id      uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      instagram_handle  text,
      tiktok_handle     text,
      start_waist_inches real,
      won_categories    text[] NOT NULL DEFAULT '{}',
      enrolled_at       timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS contest_enrollment_unique
      ON contest_enrollments (challenge_id, user_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS contest_entries (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id   uuid NOT NULL REFERENCES contest_enrollments(id) ON DELETE CASCADE,
      entry_type      text NOT NULL,
      reel_url        text,
      reel_platform   text,
      reel_view_count integer,
      title           text,
      story           text,
      photo_urls      text[],
      waist_inches    real,
      created_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now()
    )
  `;

  console.log("✅ contest_enrollments + contest_entries tables ready");
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
