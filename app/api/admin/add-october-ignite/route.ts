import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [admin] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (admin?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await db.execute(sql`ALTER TABLE workouts ADD COLUMN IF NOT EXISTS video_url text`);

  await db.execute(sql`
    INSERT INTO workouts (
      slug, title, description, instructor, duration_min, intensity,
      body_focus, equipment, uses_hoop, video_url, published_at, sort_order
    ) VALUES (
      'october-ignite',
      'October Ignite',
      'Your 30-minute hoop burn. Halloween energy — high intensity, full body, all fire.',
      'Ashley',
      30,
      'intermediate',
      ARRAY['core','full-body','cardio'],
      ARRAY['hoop'],
      true,
      'https://okntwdbbmyzw9bvc.public.blob.vercel-storage.com/videos/october-ignite-JcWoQAwCUygRqc4UuArgArlHLyRD1I.mp4',
      NOW(),
      0
    )
    ON CONFLICT (slug) DO UPDATE SET
      video_url = EXCLUDED.video_url,
      published_at = COALESCE(workouts.published_at, EXCLUDED.published_at)
  `);

  const [workout] = await db.execute(sql`SELECT id, slug, title, video_url FROM workouts WHERE slug = 'october-ignite'`);

  return NextResponse.json({ ok: true, workout });
}
