/**
 * One-shot migration: create the conversations + messages tables for the DM
 * feature. Idempotent — uses CREATE TABLE IF NOT EXISTS so it's safe to re-run.
 *
 * Drizzle-kit push hangs on the Supabase pooler's introspection, so we run the
 * raw SQL through our own db client (which handles the pooler correctly).
 */
import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_min_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_max_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_message_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS conversations_pair_uniq
      ON conversations (user_min_id, user_max_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS conversations_user_min_idx
      ON conversations (user_min_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS conversations_user_max_idx
      ON conversations (user_max_id);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body text NOT NULL,
      read_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS messages_conv_created_idx
      ON messages (conversation_id, created_at);
  `);

  console.log("Migration applied: conversations + messages tables ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
