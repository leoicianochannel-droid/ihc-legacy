import { db, notifications } from "./db";

type NotifType =
  | "post_reply"
  | "mention"
  | "streak_risk"
  | "buddy_checkin"
  | "challenge_starting"
  | "milestone_reached"
  | "billing"
  | "system";

export async function createNotification(
  userId: string,
  opts: {
    type: NotifType;
    title: string;
    body?: string;
    actionUrl?: string;
  }
) {
  await db
    .insert(notifications)
    .values({
      userId,
      type: opts.type as never, // enum value — cast needed until migration adds 'mention'
      title: opts.title,
      body: opts.body ?? null,
      actionUrl: opts.actionUrl ?? null,
    })
    .catch(() => {});
}
