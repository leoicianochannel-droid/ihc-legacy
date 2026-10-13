import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getActiveHoopers } from "@/lib/live-presence";

export const runtime = "nodejs";

/** Returns currently-active hoopers for the LivePill client component to poll. */
export async function GET(_req: NextRequest) {
  const { userId: clerkId } = await auth();
  let meId: string | undefined;
  if (clerkId) {
    const [me] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
    meId = me?.id;
  }
  const data = await getActiveHoopers({ excludeUserId: meId, limit: 12 });
  return NextResponse.json(data, {
    // Tiny client cache so several pills on the same page coalesce
    headers: { "Cache-Control": "private, max-age=10" },
  });
}
