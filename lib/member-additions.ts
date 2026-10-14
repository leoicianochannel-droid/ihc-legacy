import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

// Creates the member_additions table on first use, so this feature can ship
// without a separate migration step. Mirrors the memberAdditions definition
// in lib/db/schema.ts. Runs once per server process.
let ensured: Promise<void> | null = null;

export function ensureMemberAdditionsTable(): Promise<void> {
  ensured ??= db
    .execute(sql`
      CREATE TABLE IF NOT EXISTS member_additions (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        added_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        added_by_name text NOT NULL,
        added_by_email text NOT NULL,
        added_at timestamptz NOT NULL DEFAULT now(),
        access text NOT NULL,
        free_access_until timestamptz,
        note text,
        invite_email_sent boolean NOT NULL DEFAULT false
      )
    `)
    .then(() => undefined)
    .catch((err) => {
      ensured = null; // retry on the next call
      throw err;
    });
  return ensured;
}
