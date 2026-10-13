import { NextResponse } from "next/server";
import { db, challenges, challengeMembers, challengeCheckins, users } from "@/lib/db";
import { sendEmail, challengeProgressEmail } from "@/lib/email";
import { eq, and, gte, isNull, count } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60;

const CHALLENGE_SLUG = "30-day-challenge";
const CURRENT_RUN_START = new Date("2026-07-01T00:00:00Z");
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ihcommunity.com";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const [challenge] = await db
    .select({ id: challenges.id, title: challenges.title, durationDays: challenges.durationDays })
    .from(challenges)
    .where(eq(challenges.slug, CHALLENGE_SLUG))
    .limit(1);

  if (!challenge) {
    return NextResponse.json({ error: "challenge_not_found" }, { status: 404 });
  }

  const totalDays = challenge.durationDays ?? 30;
  const challengeName = challenge.title ?? "30-Day Challenge";

  // Week number based on days elapsed since challenge start
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysSinceStart = Math.floor((Date.now() - CURRENT_RUN_START.getTime()) / msPerDay);
  const weekNumber = Math.max(1, Math.ceil((daysSinceStart + 1) / 7));

  // Active members from the current run (not yet completed)
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

  // Check-in counts per member
  const memberIds = activeMembers.map((m) => m.id);
  const checkinRows = await Promise.all(
    memberIds.map((mid) =>
      db
        .select({ challengeMemberId: challengeCheckins.challengeMemberId, total: count() })
        .from(challengeCheckins)
        .where(eq(challengeCheckins.challengeMemberId, mid))
        .groupBy(challengeCheckins.challengeMemberId)
        .then((rows) => rows[0] ?? { challengeMemberId: mid, total: 0 })
    )
  );
  const checkinMap = new Map(checkinRows.map((r) => [r.challengeMemberId, Number(r.total)]));

  let sent = 0;
  let skipped = 0;

  for (const member of activeMembers) {
    const [user] = await db
      .select({ email: users.email, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, member.userId))
      .limit(1);

    if (!user?.email) {
      skipped++;
      continue;
    }

    const daysCompleted = checkinMap.get(member.id) ?? 0;
    const { subject, html } = challengeProgressEmail({
      firstName: user.firstName ?? "there",
      appUrl: APP_URL,
      challengeName,
      daysCompleted,
      totalDays,
      weekNumber,
      currentDay: member.currentDay ?? 1,
    });

    const result = await sendEmail({ to: user.email, subject, html });
    if (result.ok) {
      sent++;
    } else {
      skipped++;
    }
  }

  return NextResponse.json({ sent, skipped, weekNumber });
}
