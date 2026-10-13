"use server";

import { auth } from "@clerk/nextjs/server";
import {
  db,
  users,
  conversations,
  messages,
} from "@/lib/db";
import { and, asc, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendPushToUser } from "@/lib/push";
import { sendEmail } from "@/lib/email";

async function requireMe() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("not authenticated");
  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) throw new Error("no user");
  return me;
}

/**
 * Find or create a 1:1 conversation between the current user and `otherUserId`.
 * Stores the lower UUID as `userMinId` so look-ups are deterministic regardless
 * of who initiated.
 */
export async function findOrCreateConversation(otherUserId: string): Promise<string> {
  const me = await requireMe();
  if (otherUserId === me.id) throw new Error("cannot DM yourself");

  const [minId, maxId] = me.id < otherUserId ? [me.id, otherUserId] : [otherUserId, me.id];

  const [existing] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.userMinId, minId), eq(conversations.userMaxId, maxId)))
    .limit(1);

  if (existing) return existing.id;

  const [created] = await db
    .insert(conversations)
    .values({ userMinId: minId, userMaxId: maxId })
    .returning({ id: conversations.id });

  return created.id;
}

/** Server action variant — used from form actions / "Message" buttons. */
export async function startConversationWith(otherUserId: string) {
  try {
    const id = await findOrCreateConversation(otherUserId);
    redirect(`/messages/${id}`);
  } catch (err: unknown) {
    // Re-throw Next.js redirect/notFound errors — those are control flow, not real errors
    if (err && typeof err === "object" && "digest" in err) throw err;
    // Anything else (no DB record, cannot DM yourself, etc.) → send to messages list
    redirect("/messages");
  }
}

export async function sendMessage(conversationId: string, rawBody: string) {
  const me = await requireMe();
  const body = rawBody.trim().slice(0, 4000);
  if (!body) return { ok: false as const, error: "Message can't be empty." };

  // Ensure user is a participant
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conv) return { ok: false as const, error: "Conversation not found." };
  if (conv.userMinId !== me.id && conv.userMaxId !== me.id) {
    return { ok: false as const, error: "You're not in this conversation." };
  }

  await db.insert(messages).values({
    conversationId,
    senderId: me.id,
    body,
  });
  await db
    .update(conversations)
    .set({ lastMessageAt: sql`now()` })
    .where(eq(conversations.id, conversationId));

  // Notify the other participant. Fire-and-forget so a notification failure
  // can't block the message from being saved.
  const recipientId = conv.userMinId === me.id ? conv.userMaxId : conv.userMinId;
  const senderName =
    `${me.firstName ?? "Someone"} ${(me.lastName ?? "").slice(0, 1)}${me.lastName ? "." : ""}`.trim();

  ;(async () => {
    try {
      const { sent } = await sendPushToUser(recipientId, {
        title: `New message from ${senderName}`,
        body: body.slice(0, 140),
        url: `/messages/${conversationId}`,
        tag: `dm-${conversationId}`,
      });

      // Push reached no devices — fall back to email so the message doesn't
      // go unnoticed (no subscription, push blocked, or device not registered).
      if (sent === 0) {
        const [recipient] = await db
          .select({ email: users.email, firstName: users.firstName })
          .from(users)
          .where(eq(users.id, recipientId))
          .limit(1);

        if (recipient?.email) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ihcommunity.com";
          const preview = body.slice(0, 200);
          await sendEmail({
            to: recipient.email,
            subject: `New message from ${senderName}`,
            html: `
              <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
                <p style="font-size:16px;margin:0 0 12px">
                  <strong>${senderName}</strong> sent you a message on Infinity Hoop:
                </p>
                <blockquote style="border-left:3px solid #d10352;margin:0 0 20px;padding:10px 16px;background:#fdf2f7;border-radius:0 8px 8px 0;font-size:15px;color:#333">
                  ${preview.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
                </blockquote>
                <a href="${appUrl}/messages/${conversationId}"
                   style="display:inline-block;background:#d10352;color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none;font-weight:600;font-size:14px">
                  Reply to ${senderName}
                </a>
              </div>`,
          });
        }
      }
    } catch (err) {
      console.warn("dm notification failed", err);
    }
  })();

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return { ok: true as const };
}

export async function markRead(conversationId: string) {
  const me = await requireMe();
  await db
    .update(messages)
    .set({ readAt: sql`now()` })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        ne(messages.senderId, me.id),
        isNull(messages.readAt)
      )
    );
  revalidatePath("/messages");
}

export type InboxRow = {
  conversationId: string;
  otherUserId: string;
  otherFirstName: string | null;
  otherLastName: string | null;
  otherAvatarUrl: string | null;
  lastBody: string | null;
  lastAt: Date | null;
  unreadCount: number;
};

export async function listInbox(): Promise<InboxRow[]> {
  const me = await requireMe();

  // Single query — was 1 + 3N queries before, which became painful for
  // members with many conversations. Uses DISTINCT ON to pick the latest
  // message per conversation in a single sweep, and joins counts + author
  // info in the same round-trip.
  const result = await db.execute<{
    conversation_id: string;
    other_user_id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    last_body: string | null;
    last_created_at: Date | null;
    last_message_at: Date | null;
    unread_count: number;
  }>(sql`
    WITH conv AS (
      SELECT
        c.id AS conversation_id,
        CASE WHEN c.user_min_id = ${me.id} THEN c.user_max_id ELSE c.user_min_id END AS other_user_id,
        c.last_message_at
      FROM conversations c
      WHERE c.user_min_id = ${me.id} OR c.user_max_id = ${me.id}
    ),
    last_msg AS (
      SELECT DISTINCT ON (m.conversation_id)
        m.conversation_id, m.body, m.created_at
      FROM messages m
      WHERE m.conversation_id IN (SELECT conversation_id FROM conv)
      ORDER BY m.conversation_id, m.created_at DESC
    ),
    unread AS (
      SELECT m.conversation_id, count(*)::int AS n
      FROM messages m
      WHERE m.conversation_id IN (SELECT conversation_id FROM conv)
        AND m.sender_id <> ${me.id}
        AND m.read_at IS NULL
      GROUP BY m.conversation_id
    )
    SELECT
      conv.conversation_id,
      conv.other_user_id,
      u.first_name,
      u.last_name,
      u.avatar_url,
      lm.body         AS last_body,
      lm.created_at   AS last_created_at,
      conv.last_message_at,
      COALESCE(uc.n, 0)::int AS unread_count
    FROM conv
    JOIN users u ON u.id = conv.other_user_id
    LEFT JOIN last_msg lm ON lm.conversation_id = conv.conversation_id
    LEFT JOIN unread   uc ON uc.conversation_id = conv.conversation_id
    ORDER BY COALESCE(lm.created_at, conv.last_message_at) DESC NULLS LAST
    LIMIT 200
  `);

  const rows = result as unknown as Array<{
    conversation_id: string;
    other_user_id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    last_body: string | null;
    last_created_at: Date | null;
    last_message_at: Date | null;
    unread_count: number;
  }>;

  return rows.map((r) => ({
    conversationId: r.conversation_id,
    otherUserId: r.other_user_id,
    otherFirstName: r.first_name,
    otherLastName: r.last_name,
    otherAvatarUrl: r.avatar_url,
    lastBody: r.last_body,
    lastAt: r.last_created_at ?? r.last_message_at ?? null,
    unreadCount: Number(r.unread_count ?? 0),
  }));
}

export type MessageRow = {
  id: string;
  body: string;
  senderId: string;
  createdAt: Date;
  readAt: Date | null;
};

export async function loadConversation(conversationId: string): Promise<{
  ok: true;
  me: { id: string };
  other: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  };
  messages: MessageRow[];
} | { ok: false; error: string }> {
  const me = await requireMe();

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conv) return { ok: false, error: "Conversation not found." };
  if (conv.userMinId !== me.id && conv.userMaxId !== me.id) {
    return { ok: false, error: "You're not in this conversation." };
  }

  const otherId = conv.userMinId === me.id ? conv.userMaxId : conv.userMinId;
  const [other] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, otherId))
    .limit(1);

  if (!other) return { ok: false, error: "The other member's account could not be found." };

  const rows = await db
    .select({
      id: messages.id,
      body: messages.body,
      senderId: messages.senderId,
      createdAt: messages.createdAt,
      readAt: messages.readAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .limit(500);

  return {
    ok: true,
    me: { id: me.id },
    other: {
      id: other.id,
      firstName: other.firstName,
      lastName: other.lastName,
      avatarUrl: other.avatarUrl,
    },
    messages: rows,
  };
}

export async function totalUnreadCount(): Promise<number> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return 0;
  const [me] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return 0;

  const [{ unread }] = await db
    .select({ unread: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(
      and(
        or(eq(conversations.userMinId, me.id), eq(conversations.userMaxId, me.id)),
        ne(messages.senderId, me.id),
        isNull(messages.readAt)
      )
    );
  return Number(unread ?? 0);
}
