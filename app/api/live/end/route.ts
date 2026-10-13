import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { endPresence } from "@/lib/live-presence";

export const runtime = "nodejs";

/**
 * Explicit "I'm done" — called via navigator.sendBeacon when the user leaves
 * a workout page. If this misses (e.g. force-quit), the row goes stale after
 * 2 minutes anyway and stops counting.
 */
export async function POST(_req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ ok: false }, { status: 401 });

  const [me] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return NextResponse.json({ ok: false }, { status: 404 });

  await endPresence(me.id);
  return NextResponse.json({ ok: true });
}
