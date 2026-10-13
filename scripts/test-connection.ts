/**
 * Direct connection test — bypasses URL parsing by passing credentials
 * as individual fields. Proves whether the password + pooler config are correct.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

async function test(label: string, opts: Record<string, unknown>) {
  console.log(`\n--- ${label} ---`);
  console.log("opts:", { ...opts, password: "***" });
  try {
    const sql = postgres({ ...opts, max: 1, connect_timeout: 10, prepare: false });
    const result = await sql`SELECT current_user, current_database(), now()`;
    console.log("✅ SUCCESS:", result[0]);
    await sql.end({ timeout: 2 });
  } catch (err) {
    console.log("❌ FAIL:", (err as Error).message);
  }
}

async function main() {
  const password = "InfinityHoop2026";
  const projectRef = "xdjxwvznfswmshpprkqo";

  // Try 1: Pooler with separate fields
  await test("Transaction pooler (separate fields)", {
    host: `aws-1-us-west-2.pooler.supabase.com`,
    port: 6543,
    database: "postgres",
    username: `postgres.${projectRef}`,
    password,
    ssl: "require",
  });

  // Try 2: Pooler via full URL (same as what drizzle-kit uses)
  await test("Transaction pooler (URL)", {
    url: `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-1-us-west-2.pooler.supabase.com:6543/postgres`,
  });

  // Try 3: Direct connection (different endpoint)
  await test("Direct connection", {
    host: `db.${projectRef}.supabase.co`,
    port: 5432,
    database: "postgres",
    username: "postgres",
    password,
    ssl: "require",
  });
}

main().catch(console.error).finally(() => process.exit(0));
