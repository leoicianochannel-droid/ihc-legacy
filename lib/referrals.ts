import { db, users } from "./db";
import { eq } from "drizzle-orm";

/**
 * Generate a memorable referral code. Uses the member's first name as prefix
 * + 4 random alphanumeric chars — e.g. ASHLEY-K3P2.
 */
export function generateReferralCode(firstName: string | null): string {
  const prefix =
    (firstName ?? "HOOP").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) ||
    "HOOP";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

/** Ensures the user has a referral code; generates one if missing. */
export async function ensureReferralCode(userId: string): Promise<string> {
  const [u] = await db
    .select({ code: users.referralCode, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (u?.code) return u.code;

  // Retry on unique conflict
  for (let i = 0; i < 5; i++) {
    const code = generateReferralCode(u?.firstName ?? null);
    try {
      await db.update(users).set({ referralCode: code }).where(eq(users.id, userId));
      return code;
    } catch {
      // unique violation — try again
    }
  }
  throw new Error("Could not generate unique referral code");
}
