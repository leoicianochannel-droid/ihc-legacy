import { NextResponse } from "next/server";
import { db, challenges, challengeMembers, challengeCheckins, pushSubscriptions } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";
import { eq, and, gte, isNull, inArray } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60;

const CURRENT_RUN_START = new Date("2026-07-01T00:00:00Z");

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  // All active challenges
  const allChallenges = await db
    .select({ id: challenges.id, slug: challenges.slug, title: challenges.title })
    .from(challenges);

  const summary: Record<string, { sent: number; skipped: number }> = {};
  const notifiedUserIds = new Set<string>(); // avoid double-notifying across challenges

  for (const challenge of allChallenges) {
    // Active members in the current run who haven't finished
    const activeMembers = await db
      .select({ id: challengeMembers.id, userId: challengeMembers.userId, currentDay: challengeMembers.currentDay })
      .from(challengeMembers)
      .where(
        and(
          eq(challengeMembers.challengeId, challenge.id),
          gte(challengeMembers.startedAt, CURRENT_RUN_START),
          isNull(challengeMembers.completedAt)
        )
      );

    if (activeMembers.length === 0) {
      summary[challenge.slug] = { sent: 0, skipped: 0 };
      continue;
    }

    const memberIds = activeMembers.map((m) => m.id);

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

    const needsReminder = activeMembers.filter((m) => !checkedInSet.has(m.id));

    // Only notify users not already notified by an earlier challenge this run
    const unnotified = needsReminder.filter((m) => !notifiedUserIds.has(m.userId));

    if (unnotified.length === 0) {
      summary[challenge.slug] = { sent: 0, skipped: activeMembers.length };
      continue;
    }

    const userIds = unnotified.map((m) => m.userId);
    const subs = await db
      .select({ userId: pushSubscriptions.userId })
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, userIds));
    const subscribedSet = new Set(subs.map((s) => s.userId));

    const memberMap = new Map(unnotified.map((m) => [m.userId, m]));
    let sent = 0;
    let skipped = 0;

    for (const userId of userIds) {
      if (!subscribedSet.has(userId)) { skipped++; continue; }

      const member = memberMap.get(userId);
      const day = member?.currentDay ?? 1;

      await sendPushToUser(userId, {
        title: `Don't break your streak! 🏆`,
        body: `You haven't logged Day ${day} of your ${challenge.title} yet. Tap to check in.`,
        url: `/challenges/${challenge.slug}`,
        tag: "challenge-reminder",
      });

      notifiedUserIds.add(userId);
      sent++;
    }

    summary[challenge.slug] = { sent, skipped };
  }

  return NextResponse.json({ ok: true, summary });
}
