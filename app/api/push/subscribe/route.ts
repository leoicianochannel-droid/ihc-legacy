import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users, pushSubscriptions } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * Saves a Web Push subscription for the current member. The browser produces
 * the `endpoint` + `keys` after the user grants notification permission via
 * `swReg.pushManager.subscribe(...)`.
 *
 * Idempotent on `endpoint` — if the user re-enables on the same device, we
 * just bump the `userId`/`lastUsedAt` rather than creating duplicates.
 */
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [me] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return NextResponse.json({ error: "no_user" }, { status: 404 });

  let body: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const endpoint = body.endpoint;
  const p256dh = body.keys?.p256dh;
  const authKey = body.keys?.auth;
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  await db
    .insert(pushSubscriptions)
    .values({
      userId: me.id,
      endpoint,
      p256dh,
      auth: authKey,
      userAgent,
      lastUsedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: me.id,
        p256dh,
        auth: authKey,
        userAgent,
        lastUsedAt: sql`now()`,
      },
    });

  return NextResponse.json({ ok: true });
}
