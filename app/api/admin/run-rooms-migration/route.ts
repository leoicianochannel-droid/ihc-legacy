import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

export async function POST() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (me?.role !== "admin") return NextResponse.json({ error: "admin only" }, { status: 403 });

  const results: string[] = [];

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        emoji TEXT NOT NULL DEFAULT '💬',
        cover_url TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    results.push("rooms table: ok");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS room_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT room_members_unique UNIQUE (room_id, user_id)
      )
    `);
    results.push("room_members table: ok");

    await db.execute(sql`CREATE INDEX IF NOT EXISTS room_members_user_idx ON room_members(user_id)`);
    results.push("room_members_user_idx: ok");

    await db.execute(sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE SET NULL`);
    results.push("posts.room_id column: ok");

    await db.execute(sql`CREATE INDEX IF NOT EXISTS posts_room_id_idx ON posts(room_id) WHERE room_id IS NOT NULL`);
    results.push("posts_room_id_idx: ok");

    // Seed the 4 starter rooms
    await db.execute(sql`
      INSERT INTO rooms (slug, name, description, emoji, sort_order)
      VALUES
        ('beginners', 'Beginners', 'Just starting out? You belong here. Ask anything, share everything.', '🌱', 0),
        ('recipes',   'Recipes',  'Healthy meals, macro-friendly ideas, and snack inspiration.', '🥗', 1),
        ('transformations', 'Transformations', 'Show off your progress. Before & afters, NSVs, milestones.', '✨', 2),
        ('motivation', 'Motivation', 'Accountability, hype, and the push you need to keep going.', '💪', 3)
      ON CONFLICT (slug) DO NOTHING
    `);
    results.push("rooms seeded: ok");

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err), results }, { status: 500 });
  }
}
