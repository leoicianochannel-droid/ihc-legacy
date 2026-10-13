import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createCheckoutSession, PRICE_DISPLAY, type PlanKey } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const body = form
    ? { plan: (form.get("plan") as string) ?? "annual" }
    : await req.json().catch(() => ({ plan: "annual" }));

  const plan = (body.plan as PlanKey) ?? "annual";
  if (!PRICE_DISPLAY[plan]) return NextResponse.json({ error: "bad_plan" }, { status: 400 });

  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkId);
  const email = me?.email ?? clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return NextResponse.json({ error: "no_email" }, { status: 400 });

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const session = await createCheckoutSession({
    userId: me?.id ?? clerkId,
    userEmail: email,
    plan,
    successUrl: `${origin}/dashboard?upgraded=1`,
    cancelUrl: `${origin}/pricing?canceled=1`,
  });

  return NextResponse.redirect(session.url!, { status: 303 });
}
