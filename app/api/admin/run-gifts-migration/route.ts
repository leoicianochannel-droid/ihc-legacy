import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

export async function POST() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS gift_milestones (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      key text NOT NULL,
      day_threshold integer NOT NULL,
      label text NOT NULL,
      full_label text NOT NULL,
      description text NOT NULL,
      emoji text NOT NULL DEFAULT '🎁',
      retail_value text NOT NULL DEFAULT '',
      requires_shipping boolean NOT NULL DEFAULT false,
      image_url text,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS gift_milestones_key_idx ON gift_milestones (key);
  `);

  return NextResponse.json({ ok: true });
}
