import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

export async function POST() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [me] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  if (me?.role !== "admin") return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS post_reactions (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji text NOT NULL,
      created_at timestamptz DEFAULT NOW() NOT NULL,
      CONSTRAINT post_reaction_unique UNIQUE (post_id, user_id, emoji)
    );

    CREATE TABLE IF NOT EXISTS poll_options (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      text text NOT NULL,
      position integer NOT NULL DEFAULT 0,
      created_at timestamptz DEFAULT NOW() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS poll_options_post_idx ON poll_options (post_id);

    CREATE TABLE IF NOT EXISTS poll_votes (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      option_id uuid NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT NOW() NOT NULL,
      CONSTRAINT poll_votes_user_post_unique UNIQUE (user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS post_bookmarks (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT NOW() NOT NULL,
      CONSTRAINT post_bookmarks_unique UNIQUE (user_id, post_id)
    );
    CREATE INDEX IF NOT EXISTS post_bookmarks_user_idx ON post_bookmarks (user_id);
  `);

  return NextResponse.json({ ok: true, message: "Community tables migrated (post_reactions, poll_options, poll_votes, post_bookmarks)" });
}
