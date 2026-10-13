/**
 * Adds collection + challengeOnly fields to workouts (via raw SQL to avoid
 * drizzle-kit's CHECK introspection bug on Supabase).
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

  console.log("Adding collection + challengeOnly columns to workouts...");
  await sql.unsafe(`
    ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "collection" text;
    ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "challenge_only" boolean NOT NULL DEFAULT false;
    CREATE INDEX IF NOT EXISTS "workouts_collection_idx" ON "workouts"("collection");
  `);
  await sql.end({ timeout: 2 });
  console.log("✅ Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
