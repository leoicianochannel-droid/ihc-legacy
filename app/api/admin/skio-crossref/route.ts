"use server";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq, inArray, sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { emails }: { emails: string[] } = await req.json();
  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: "emails array required" }, { status: 400 });
  }

  const lower = emails.map((e) => e.toLowerCase().trim());

  // Total platform users
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(users);

  // Which Skio emails exist on the platform
  const matched = await db
    .select({ email: users.email, onboardedAt: users.onboardedAt, createdAt: users.createdAt, role: users.role })
    .from(users)
    .where(inArray(sql`lower(${users.email})`, lower));

  const matchedEmails = new Set(matched.map((u) => u.email?.toLowerCase()));
  const missing = lower.filter((e) => !matchedEmails.has(e));

  return NextResponse.json({
    skioActiveCount: emails.length,
    platformTotalUsers: total,
    onPlatform: matched.length,
    notOnPlatform: missing.length,
    missingEmails: missing.sort(),
  });
}
