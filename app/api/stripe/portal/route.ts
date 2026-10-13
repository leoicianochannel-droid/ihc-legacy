import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users, subscriptions } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createCustomerPortalSession } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return NextResponse.json({ error: "no_user" }, { status: 404 });

  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, me.id)).limit(1);
  if (!sub?.stripeCustomerId) return NextResponse.json({ error: "no_subscription" }, { status: 404 });

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const portal = await createCustomerPortalSession(sub.stripeCustomerId, `${origin}/settings`);

  return NextResponse.redirect(portal.url, { status: 303 });
}
