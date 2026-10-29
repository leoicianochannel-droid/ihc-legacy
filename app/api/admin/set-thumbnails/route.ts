import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users, workouts } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [admin] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (admin?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // map: { [slug]: thumbnailUrl }
  const map: Record<string, string> = await req.json();
  const slugs = Object.keys(map);
  if (slugs.length === 0) return NextResponse.json({ updated: 0 });

  const results = await Promise.all(
    slugs.map((slug) =>
      db
        .update(workouts)
        .set({ thumbnailUrl: map[slug] })
        .where(eq(workouts.slug, slug))
        .returning({ slug: workouts.slug })
    )
  );

  const updated = results.flat();
  return NextResponse.json({ updated: updated.length, slugs: updated.map((r) => r.slug) });
}
