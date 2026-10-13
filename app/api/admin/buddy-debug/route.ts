import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users, buddyMatches } from "@/lib/db";
import { and, eq, isNull, not, or, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [me] = await db.select({ id: users.id, role: users.role, email: users.email, onboardedAt: users.onboardedAt, migratedFromSkool: users.migratedFromSkool })
    .from(users).where(eq(users.clerkId, clerkId)).limit(1);

  const allMembers = await db.select({ id: users.id, role: users.role, email: users.email, onboardedAt: users.onboardedAt, migratedFromSkool: users.migratedFromSkool })
    .from(users).where(eq(users.role, "member"));

  const eligibleMembers = await db.select({ id: users.id, email: users.email })
    .from(users).where(and(eq(users.role, "member"), or(not(isNull(users.onboardedAt)), eq(users.migratedFromSkool, true))));

  const activeMatches = await db.select({ a: buddyMatches.userAId, b: buddyMatches.userBId })
    .from(buddyMatches).where(eq(buddyMatches.status, "active"));

  const matchedIds = new Set(activeMatches.flatMap(m => [m.a, m.b]));
  const pool = eligibleMembers.filter(u => !matchedIds.has(u.id));

  const [{ totalAll }] = await db.select({ totalAll: sql<number>`count(*)::int` }).from(users);

  return NextResponse.json({
    me: { id: me?.id, role: me?.role, email: me?.email, onboardedAt: me?.onboardedAt, migratedFromSkool: me?.migratedFromSkool },
    counts: {
      allUsers: totalAll,
      membersTotal: allMembers.length,
      membersEligible: eligibleMembers.length,
      activeMatches: activeMatches.length,
      unmatchedPool: pool.length,
    },
    membersBreakdown: {
      withOnboardedAt: allMembers.filter(u => u.onboardedAt).length,
      migratedFromSkool: allMembers.filter(u => u.migratedFromSkool).length,
      neitherSet: allMembers.filter(u => !u.onboardedAt && !u.migratedFromSkool).length,
    },
    poolMembers: pool.map(u => u.email),
  });
}
