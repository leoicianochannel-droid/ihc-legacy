import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users, workouts } from "@/lib/db";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [admin] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (admin?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const list = await db
    .select({ id: workouts.id, slug: workouts.slug, title: workouts.title, thumbnailUrl: workouts.thumbnailUrl })
    .from(workouts)
    .orderBy(asc(workouts.title));

  return NextResponse.json(list);
}
