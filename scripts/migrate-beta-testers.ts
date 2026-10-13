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
  console.log("Adding beta tester columns to users...");
  await sql.unsafe(`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_beta_tester" boolean NOT NULL DEFAULT false;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "beta_note" text;
  `);
  await sql.end({ timeout: 2 });
  console.log("✅ Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
