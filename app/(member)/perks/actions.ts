"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { generateMemberCode, isShopifyAdminConfigured } from "@/lib/shopify-admin";

/**
 * Returns the member's existing discount code, or generates one via Shopify API
 * if they don't have one yet. Safe to call multiple times — idempotent.
 */
export async function claimDiscountCode(): Promise<{ code: string | null; pending: boolean }> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { code: null, pending: false };

  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return { code: null, pending: false };

  // Already has a code — return it
  if (me.shopDiscountCode) {
    return { code: me.shopDiscountCode, pending: false };
  }

  // Shopify not configured yet — caller shows a "coming soon" state
  if (!isShopifyAdminConfigured()) {
    return { code: null, pending: true };
  }

  // Generate a fresh code and save it
  try {
    const code = await generateMemberCode(me.firstName);
    await db.update(users).set({ shopDiscountCode: code }).where(eq(users.id, me.id));
    return { code, pending: false };
  } catch (err) {
    console.error("Failed to generate Shopify discount code:", err);
    return { code: null, pending: true };
  }
}
