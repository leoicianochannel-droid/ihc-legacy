/**
 * Applies the new referrals + premium waitlist schema directly via SQL.
 * (Used instead of drizzle-kit push because drizzle-kit has a known bug
 * with Supabase's CHECK constraint introspection.)
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
  const sql = postgres({
    ...parseUrl(process.env.DATABASE_URL!),
    prepare: false,
    max: 1,
  });

  console.log("Applying referrals + premium waitlist schema...");

  await sql.unsafe(`
    -- Add columns to users
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_code" text;
    CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_idx"
      ON "users"("referral_code") WHERE "referral_code" IS NOT NULL;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referred_by_user_id" uuid;

    -- Referral status enum
    DO $$ BEGIN
      CREATE TYPE "referral_status" AS ENUM ('pending', 'activated', 'rewarded');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Referrals table
    CREATE TABLE IF NOT EXISTS "referrals" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "referrer_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "referred_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "referred_email" text,
      "status" "referral_status" NOT NULL DEFAULT 'pending',
      "reward_applied_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "referrals_referrer_idx" ON "referrals"("referrer_user_id");

    -- Premium waitlist table
    CREATE TABLE IF NOT EXISTS "premium_waitlist" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "email" text NOT NULL,
      "interested_features" text[] NOT NULL DEFAULT '{}',
      "note" text,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Generate referral codes for any existing users who don't have one
  const usersWithoutCode = await sql`
    SELECT id, first_name FROM users WHERE referral_code IS NULL
  `;
  console.log(`Generating codes for ${usersWithoutCode.length} existing user(s)...`);

  for (const u of usersWithoutCode) {
    const prefix = (u.first_name ?? "hoop").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "HOOP";
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const code = `${prefix}-${suffix}`;
    await sql`UPDATE users SET referral_code = ${code} WHERE id = ${u.id}`;
  }

  await sql.end({ timeout: 2 });
  console.log("✅ Schema applied.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
