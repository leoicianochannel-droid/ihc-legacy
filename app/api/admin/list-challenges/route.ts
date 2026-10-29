import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { challenges } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [admin] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (admin?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const list = await db
    .select({ id: challenges.id, slug: challenges.slug, title: challenges.title, coverUrl: challenges.coverUrl })
    .from(challenges)
    .orderBy(asc(challenges.title));

  return NextResponse.json(list);
}
