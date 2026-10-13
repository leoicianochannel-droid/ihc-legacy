/**
 * Syncs a user's Skio subscription state into our local subscriptions table.
 * Called from the onboarding action and from a sign-in hook so existing Skio
 * subscribers get instant access when they create their account.
 */
import { db, users, subscriptions } from "./db";
import { eq } from "drizzle-orm";
import { findSubscriptionsByEmail } from "./skio";

export async function syncSkioSubscriptionForUser(userId: string, email: string) {
  let subs;
  try {
    subs = await findSubscriptionsByEmail(email);
  } catch (err) {
    console.warn("Skio sync failed (continuing without it):", (err as Error).message);
    return null;
  }

  // Find an active subscription for the community product
  const COMMUNITY_PRODUCT_SLUGS = ["infinity-community", "community"];
  const active = subs.find(
    (s) =>
      s.status === "ACTIVE" &&
      (s.SubscriptionLines ?? []).some((line) =>
        COMMUNITY_PRODUCT_SLUGS.includes(line.ProductVariant?.Product?.slug ?? "")
      )
  );

  if (!active) return null;

  // Upsert into subscriptions
  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.skioSubscriptionId, active.id))
    .limit(1);

  const values = {
    userId,
    skioSubscriptionId: active.id,
    status: "active" as const,
    plan: "monthly" as const,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(subscriptions).set(values).where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values({ ...values, createdAt: new Date() });
  }

  return active;
}
