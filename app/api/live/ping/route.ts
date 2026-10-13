import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { pingPresence } from "@/lib/live-presence";

export const runtime = "nodejs";

/** Heartbeat endpoint — workout player calls this every ~30s while playing. */
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ ok: false }, { status: 401 });

  const [me] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return NextResponse.json({ ok: false }, { status: 404 });

  let body: { workoutId?: string | null } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — heartbeat with no workout context still records presence
  }

  await pingPresence(me.id, body.workoutId ?? null);
  return NextResponse.json({ ok: true });
}
