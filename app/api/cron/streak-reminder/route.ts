import { NextResponse } from "next/server";
import { db, users, pushSubscriptions, activityLog } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";
import { eq, isNotNull, gte, and, inArray } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  // Vercel automatically adds Authorization: Bearer <CRON_SECRET> on cron invocations.
  // Reject any caller that doesn't have it so this endpoint isn't abused.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();

  // Find members who have a reminder_time set
  const candidates = await db
    .select({
      id: users.id,
      timezone: users.timezone,
      reminderTime: users.reminderTime,
    })
    .from(users)
    .where(isNotNull(users.reminderTime));

  // Filter to members whose local time matches the current UTC hour
  const toRemind: string[] = [];
  for (const u of candidates) {
    if (!u.reminderTime) continue;
    const tz = u.timezone ?? "America/New_York";

    // Get the current hour in the member's local timezone
    const localHour = new Date(
      now.toLocaleString("en-US", { timeZone: tz })
    ).getHours();

    const reminderHour = parseInt(u.reminderTime.split(":")[0], 10);
    if (localHour === reminderHour) {
      toRemind.push(u.id);
    }
  }

  if (toRemind.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 });
  }

  // Check which of those members already have a push subscription
  const subs = await db
    .select({ userId: pushSubscriptions.userId })
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, toRemind));
  const subscribedIds = new Set(subs.map((s) => s.userId));

  // Check which members already logged activity today (in UTC — good enough
  // approximation; off-by-one at midnight edge cases are acceptable)
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const alreadyActive = await db
    .select({ userId: activityLog.userId })
    .from(activityLog)
    .where(
      and(
        inArray(activityLog.userId, toRemind),
        gte(activityLog.createdAt, todayStart)
      )
    );
  const activeIds = new Set(alreadyActive.map((a) => a.userId));

  // Send to members who have a subscription and haven't worked out yet
  let sent = 0;
  let skipped = 0;
  for (const userId of toRemind) {
    if (!subscribedIds.has(userId) || activeIds.has(userId)) {
      skipped++;
      continue;
    }
    await sendPushToUser(userId, {
      title: "Time to move! 💜",
      body: "Your daily workout is waiting — check in to keep your streak alive.",
      url: "/dashboard",
      tag: "streak-reminder",
    });
    sent++;
  }

  return NextResponse.json({ sent, skipped });
}
