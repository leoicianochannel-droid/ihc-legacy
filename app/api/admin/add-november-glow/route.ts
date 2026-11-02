import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [admin] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (admin?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const videoUrl = body.videoUrl as string | undefined;
  if (!videoUrl) return NextResponse.json({ error: "videoUrl required" }, { status: 400 });

  await db.execute(sql`
    INSERT INTO workouts (
      slug, title, description, instructor, duration_min, intensity,
      body_focus, equipment, uses_hoop, video_url, published_at, sort_order
    ) VALUES (
      'november-glow',
      'November Glow',
      'Your 30-minute glow-up session. Feel the burn, keep the flow.',
      'Ashley',
      30,
      'intermediate',
      ARRAY['core','full-body','cardio'],
      ARRAY['hoop'],
      true,
      ${videoUrl},
      NOW(),
      0
    )
    ON CONFLICT (slug) DO UPDATE SET
      video_url = EXCLUDED.video_url,
      published_at = COALESCE(workouts.published_at, EXCLUDED.published_at)
  `);

  const [workout] = await db.execute(sql`SELECT id, slug, title, video_url FROM workouts WHERE slug = 'november-glow'`);

  return NextResponse.json({ ok: true, workout });
}
