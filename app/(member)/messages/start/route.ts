import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users, conversations } from "@/lib/db";
import { and, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.redirect(new URL("/sign-in", req.url));

    const otherUserId = req.nextUrl.searchParams.get("userId");
    if (!otherUserId) return NextResponse.redirect(new URL("/messages", req.url));

    const [me] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (!me) return NextResponse.redirect(new URL("/onboarding", req.url));
    if (me.id === otherUserId) return NextResponse.redirect(new URL("/messages", req.url));

    // Verify the other user exists
    const [otherUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, otherUserId))
      .limit(1);

    if (!otherUser) return NextResponse.redirect(new URL("/messages", req.url));

    const [minId, maxId] =
      me.id < otherUserId ? [me.id, otherUserId] : [otherUserId, me.id];

    // Find existing conversation
    const [existing] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.userMinId, minId), eq(conversations.userMaxId, maxId)))
      .limit(1);

    if (existing) {
      return NextResponse.redirect(new URL(`/messages/${existing.id}`, req.url));
    }

    // Create new conversation
    const [created] = await db
      .insert(conversations)
      .values({ userMinId: minId, userMaxId: maxId })
      .returning({ id: conversations.id });

    return NextResponse.redirect(new URL(`/messages/${created.id}`, req.url));
  } catch (err) {
    console.error("[messages/start] error:", err);
    return NextResponse.redirect(new URL("/messages", req.url));
  }
}
