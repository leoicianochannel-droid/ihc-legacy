/**
 * Web Push helpers — server-side. Encrypts and sends notifications to a
 * member's registered devices. Runs on the Node runtime (web-push uses
 * crypto bindings not available on Edge).
 *
 * Trigger this via `sendPushToUser(userId, payload)` from any server action,
 * webhook, or route handler. Failures don't throw — bad subscriptions get
 * pruned silently so the caller's flow isn't blocked by a stale phone.
 */
import "server-only";
import webpush from "web-push";
import { db, pushSubscriptions } from "./db";
import { eq, sql } from "drizzle-orm";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const subject = process.env.VAPID_SUBJECT;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !pub || !priv) {
    throw new Error(
      "Missing VAPID env vars — set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT."
    );
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;          // path the notification opens, e.g. "/messages/abc"
  tag?: string;          // groups notifications so the same convo collapses
  icon?: string;
  badge?: string;
};

/**
 * Send a push notification to every device this user has enabled.
 * Stale endpoints (404 / 410) are deleted so they don't accumulate.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; pruned: number }> {
  ensureConfigured();

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) return { sent: 0, pruned: 0 };

  const json = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    tag: payload.tag,
    icon: payload.icon ?? "/icon-192.png",
    badge: payload.badge ?? "/icon-192.png",
  });

  let sent = 0;
  let pruned = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          json
        );
        sent++;
        await db
          .update(pushSubscriptions)
          .set({ lastUsedAt: sql`now()` })
          .where(eq(pushSubscriptions.id, sub.id));
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          // Endpoint is gone — uninstalled, blocked, or expired. Prune it.
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, sub.id));
          pruned++;
        } else {
          // Transient errors — log and move on. Don't blow up the caller.
          console.warn("Push send failed", { endpoint: sub.endpoint, err });
        }
      }
    })
  );

  return { sent, pruned };
}
