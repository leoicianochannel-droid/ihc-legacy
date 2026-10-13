/**
 * Adds `programs`, `program_days`, `program_day_exercises`, `program_members`,
 * and `program_day_completions` tables.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

function parseUrl(raw: string) {
  const u = new URL(raw);
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    database: u.pathname.replace(/^\//, "") || "postgres",
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl: "require" as const,
  };
}

async function main() {
  const sql = postgres({ ...parseUrl(process.env.DATABASE_URL!), prepare: false, max: 1 });

  console.log("Creating programs tables...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "programs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "slug" text UNIQUE NOT NULL,
      "title" text NOT NULL,
      "subtitle" text,
      "description" text,
      "cover_url" text,
      "duration_days" integer NOT NULL,
      "is_active" boolean NOT NULL DEFAULT true,
      "sort_order" integer DEFAULT 0,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "program_days" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "program_id" uuid NOT NULL REFERENCES "programs"("id") ON DELETE CASCADE,
      "day_number" integer NOT NULL,
      "title" text NOT NULL,
      "description" text,
      "is_rest_day" boolean NOT NULL DEFAULT false
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "program_day_unique"
      ON "program_days"("program_id", "day_number");

    CREATE TABLE IF NOT EXISTS "program_day_exercises" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "program_day_id" uuid NOT NULL REFERENCES "program_days"("id") ON DELETE CASCADE,
      "workout_id" uuid REFERENCES "workouts"("id") ON DELETE SET NULL,
      "label" text NOT NULL,
      "reps_label" text,
      "sort_order" integer NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS "pde_program_day_idx" ON "program_day_exercises"("program_day_id");

    CREATE TABLE IF NOT EXISTS "program_members" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "program_id" uuid NOT NULL REFERENCES "programs"("id") ON DELETE CASCADE,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "started_at" timestamptz NOT NULL DEFAULT now(),
      "current_day" integer NOT NULL DEFAULT 1,
      "completed_at" timestamptz
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "program_member_unique"
      ON "program_members"("program_id", "user_id");

    CREATE TABLE IF NOT EXISTS "program_day_completions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "program_member_id" uuid NOT NULL REFERENCES "program_members"("id") ON DELETE CASCADE,
      "day_number" integer NOT NULL,
      "completed_at" timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "program_day_done_unique"
      ON "program_day_completions"("program_member_id", "day_number");
  `);

  await sql.end({ timeout: 2 });
  console.log("✅ Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
