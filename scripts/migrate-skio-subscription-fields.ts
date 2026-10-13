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
  console.log("Adding Skio fields to subscriptions...");
  await sql.unsafe(`
    ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "skio_subscription_id" text;
    ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "shopify_customer_id" text;
    CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_skio_id_idx"
      ON "subscriptions"("skio_subscription_id") WHERE "skio_subscription_id" IS NOT NULL;
    -- Make Stripe fields nullable since we're migrating away from Stripe
    ALTER TABLE "subscriptions" ALTER COLUMN "stripe_customer_id" DROP NOT NULL;
  `);
  await sql.end({ timeout: 2 });
  console.log("✅ Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
