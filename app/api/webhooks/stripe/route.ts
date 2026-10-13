import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db, users, subscriptions } from "@/lib/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

async function upsertSubscription(sub: Stripe.Subscription, userIdFallback?: string) {
  const userId = (sub.metadata?.userId as string) ?? userIdFallback;
  if (!userId) {
    console.warn("Stripe webhook: sub has no userId metadata", sub.id);
    return;
  }

  // Derive plan from the first price
  const priceId = sub.items.data[0]?.price.id;
  const planKey: "monthly" | "annual" =
    priceId === process.env.STRIPE_PRICE_ANNUAL ? "annual" : "monthly";

  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, sub.id))
    .limit(1);

  const values = {
    userId,
    stripeCustomerId: sub.customer as string,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId ?? null,
    status: sub.status as typeof subscriptions.$inferInsert.status,
    plan: planKey,
    currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
    cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
    trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
  };

  if (existing) {
    await db
      .update(subscriptions)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values(values);
  }
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ error: "no_signature" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (session.subscription && userId) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await upsertSubscription(sub, userId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscription(sub);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("Stripe webhook handler error", err);
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
