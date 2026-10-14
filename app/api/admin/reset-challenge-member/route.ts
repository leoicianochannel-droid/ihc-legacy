import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users, challengeMembers, challenges } from "@/lib/db";
import { eq, and, ilike } from "drizzle-orm";

// POST /api/admin/reset-challenge-member
// Body: { email: string, challengeSlug: string, resetDay?: number }
// Clears completedAt and optionally resets currentDay so a member can continue.
export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [admin] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (admin?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { email, challengeSlug, resetDay } = body as {
    email?: string;
    challengeSlug?: string;
    resetDay?: number;
  };

  if (!email || !challengeSlug) {
    return NextResponse.json({ error: "email and challengeSlug are required" }, { status: 400 });
  }

  const [member] = await db.select().from(users).where(ilike(users.email, email)).limit(1);
  if (!member) return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 });

  const [challenge] = await db.select().from(challenges).where(eq(challenges.slug, challengeSlug)).limit(1);
  if (!challenge) return NextResponse.json({ error: `No challenge with slug: ${challengeSlug}` }, { status: 404 });

  const [cm] = await db
    .select()
    .from(challengeMembers)
    .where(and(eq(challengeMembers.userId, member.id), eq(challengeMembers.challengeId, challenge.id)))
    .limit(1);
  if (!cm) return NextResponse.json({ error: `${email} is not in challenge ${challengeSlug}` }, { status: 404 });

  const newDay = resetDay ?? cm.currentDay;

  await db
    .update(challengeMembers)
    .set({ completedAt: null, currentDay: newDay })
    .where(eq(challengeMembers.id, cm.id));

  return NextResponse.json({
    ok: true,
    user: member.email,
    challenge: challengeSlug,
    currentDay: newDay,
    wasCompletedAt: cm.completedAt,
    message: `Cleared completedAt. currentDay set to ${newDay}. Member can now continue the challenge.`,
  });
}
