/**
 * Adds Cloudflare Stream fields to the workouts table.
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
  console.log("Adding Cloudflare Stream columns to workouts...");
  await sql.unsafe(`
    ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "cf_stream_uid" text;
    ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "cf_stream_status" text;
    ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "cf_customer_code" text;
    CREATE INDEX IF NOT EXISTS "workouts_cf_uid_idx" ON "workouts"("cf_stream_uid");
  `);
  await sql.end({ timeout: 2 });
  console.log("✅ Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
