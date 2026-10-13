import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { users } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (me?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS post_reactions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS post_reaction_unique
      ON post_reactions (post_id, user_id, emoji);
  `);

  return NextResponse.json({ ok: true });
}
