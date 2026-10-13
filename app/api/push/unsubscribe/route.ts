import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users, pushSubscriptions } from "@/lib/db";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * Removes a push subscription for the current user. The client passes the
 * `endpoint` it had registered. We scope the delete to the calling user so
 * one user can't accidentally / maliciously unregister another's device.
 */
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [me] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return NextResponse.json({ error: "no_user" }, { status: 404 });

  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  if (!body.endpoint) return NextResponse.json({ error: "missing_endpoint" }, { status: 400 });

  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, me.id),
        eq(pushSubscriptions.endpoint, body.endpoint)
      )
    );

  return NextResponse.json({ ok: true });
}
