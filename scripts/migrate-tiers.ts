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
  console.log("Adding tier system tables/columns...");
  await sql.unsafe(`
    DO $$ BEGIN
      CREATE TYPE "tier" AS ENUM ('starter', 'mover', 'champion', 'legend');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tier" "tier" NOT NULL DEFAULT 'starter';
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tier_unlocked_at" timestamptz;

    CREATE TABLE IF NOT EXISTS "tier_unlocks" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "tier" "tier" NOT NULL,
      "unlocked_at" timestamptz NOT NULL DEFAULT now(),
      "workouts_at_unlock" integer NOT NULL,
      "streak_at_unlock" integer NOT NULL,
      "celebrated" boolean NOT NULL DEFAULT false
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "user_tier_unique" ON "tier_unlocks"("user_id", "tier");
  `);
  await sql.end({ timeout: 2 });
  console.log("✅ Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
