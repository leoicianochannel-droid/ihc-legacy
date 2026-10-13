import { NextResponse } from "next/server";
import { db, challenges, challengeMembers, challengeCheckins, pushSubscriptions } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";
import { eq, and, gte, isNull, isNotNull, inArray, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60;

const CHALLENGE_SLUG = "30-day-challenge";
const CURRENT_RUN_START = new Date("2026-07-01T00:00:00Z");

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Resolve the challenge ID
  const [challenge] = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(eq(challenges.slug, CHALLENGE_SLUG))
    .limit(1);

  if (!challenge) {
    return NextResponse.json({ error: "challenge_not_found" }, { status: 404 });
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  // Active members from the current challenge run who haven't finished yet
  const activeMembers = await db
    .select({
      id: challengeMembers.id,
      userId: challengeMembers.userId,
      currentDay: challengeMembers.currentDay,
    })
    .from(challengeMembers)
    .where(
      and(
        eq(challengeMembers.challengeId, challenge.id),
        gte(challengeMembers.startedAt, CURRENT_RUN_START),
        isNull(challengeMembers.completedAt)
      )
    );

  if (activeMembers.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 });
  }

  const memberIds = activeMembers.map((m) => m.id);
  const memberMap = new Map(activeMembers.map((m) => [m.id, m]));
  const userIdToMemberId = new Map(activeMembers.map((m) => [m.userId, m.id]));

  // Members who already checked in today
  const checkedInToday = await db
    .select({ challengeMemberId: challengeCheckins.challengeMemberId })
    .from(challengeCheckins)
    .where(
      and(
        inArray(challengeCheckins.challengeMemberId, memberIds),
        gte(challengeCheckins.completedAt, todayStart)
      )
    );
  const checkedInSet = new Set(checkedInToday.map((c) => c.challengeMemberId));

  // Members who need a reminder (not yet checked in today)
  const needsReminder = activeMembers
    .filter((m) => !checkedInSet.has(m.id))
    .map((m) => m.userId);

  if (needsReminder.length === 0) {
    return NextResponse.json({ sent: 0, skipped: activeMembers.length });
  }

  // Filter to those with push subscriptions
  const subs = await db
    .select({ userId: pushSubscriptions.userId })
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, needsReminder));
  const subscribedUserIds = new Set(subs.map((s) => s.userId));

  let sent = 0;
  let skipped = 0;

  for (const userId of needsReminder) {
    if (!subscribedUserIds.has(userId)) {
      skipped++;
      continue;
    }
    const memberId = userIdToMemberId.get(userId);
    const member = memberId ? memberMap.get(memberId) : undefined;
    const day = member?.currentDay ?? 1;

    await sendPushToUser(userId, {
      title: `Day ${day} of 30 — don't break your streak! 🏆`,
      body: "You haven't checked in yet today. Tap to log your workout and stay in the challenge.",
      url: `/challenges/${CHALLENGE_SLUG}`,
      tag: "challenge-reminder",
    });
    sent++;
  }

  return NextResponse.json({ sent, skipped });
}
