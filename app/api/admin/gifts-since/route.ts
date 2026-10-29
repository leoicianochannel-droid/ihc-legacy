import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users, giftClaims } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { getDbMilestones, daysSince } from "@/lib/gifts";

export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [admin] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (admin?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  // since = ISO date string, e.g. "2026-10-12"
  const sinceParam = searchParams.get("since");
  const sinceDate = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // default: last 10 days

  const milestones = await getDbMilestones();

  // Only include active subscribers
  const activeSubs = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(inArray(subscriptions.status, ["active", "trialing", "past_due"]));
  const activeUserIds = new Set(activeSubs.map((s) => s.userId));

  const allUsers = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email, onboardedAt: users.onboardedAt, createdAt: users.createdAt })
    .from(users)
    .orderBy(asc(users.createdAt));
  const allClaims = await db.select().from(giftClaims);

  const claimsByUser = new Map<string, typeof allClaims>();
  for (const c of allClaims) {
    const list = claimsByUser.get(c.userId) ?? [];
    list.push(c);
    claimsByUser.set(c.userId, list);
  }

  const results: {
    name: string;
    email: string;
    daysMember: number;
    gift: string;
    unlockedApprox: string;
    claimed: boolean;
    shipped: boolean;
  }[] = [];

  for (const u of allUsers) {
    // Skip non-active subscribers
    if (!activeUserIds.has(u.id)) continue;

    const startDate = new Date(u.onboardedAt ?? u.createdAt);
    const claims = claimsByUser.get(u.id) ?? [];
    const claimMap = new Map(claims.map((c) => [c.milestoneKey, c]));
    const daysMember = daysSince(startDate);

    for (const m of milestones) {
      if (daysMember < m.dayThreshold) continue; // hasn't hit this milestone yet

      // When did they cross this threshold?
      const crossedAt = new Date(startDate.getTime() + m.dayThreshold * 24 * 60 * 60 * 1000);
      if (crossedAt < sinceDate) continue; // crossed before the cutoff

      const claim = claimMap.get(m.key);

      // Only include unclaimed gifts (these are the ones that need to be manually sent)
      if (claim?.claimedAt) continue;

      results.push({
        name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "Unknown",
        email: u.email ?? "",
        daysMember,
        gift: `${m.emoji} ${m.fullLabel}`,
        unlockedApprox: crossedAt.toISOString().slice(0, 10),
        claimed: false,
        shipped: false,
      });
    }
  }

  results.sort((a, b) => a.unlockedApprox.localeCompare(b.unlockedApprox));

  return NextResponse.json({ since: sinceDate.toISOString().slice(0, 10), count: results.length, results });
}
