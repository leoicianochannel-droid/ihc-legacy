/** Migration: create admin_invites. Idempotent. */
import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS admin_invites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      token text NOT NULL,
      label text,
      created_by_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      max_uses integer,
      used_count integer NOT NULL DEFAULT 0,
      expires_at timestamptz,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS admin_invites_token_uniq
      ON admin_invites (token);
  `);
  console.log("Migration applied: admin_invites ready.");
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
