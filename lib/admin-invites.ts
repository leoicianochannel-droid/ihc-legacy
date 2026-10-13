/**
 * Admin invite helpers shared between the admin UI, the public landing page,
 * and the onboarding flow.
 */
import { db, adminInvites } from "./db";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";

/** Cookie name used to carry an invite token across the Clerk sign-up redirect. */
export const ADMIN_INVITE_COOKIE = "ih_admin_invite";

/** Generate a URL-safe random token. 16 bytes → 22 chars base64url. */
export function generateInviteToken(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * Validate an invite token without consuming it. Returns the invite row when
 * the token exists, isn't revoked, hasn't expired, and hasn't hit its max uses.
 */
export async function validateInvite(token: string) {
  if (!token || typeof token !== "string") return null;
  const [row] = await db
    .select()
    .from(adminInvites)
    .where(eq(adminInvites.token, token))
    .limit(1);
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt && new Date(row.expiresAt) < new Date()) return null;
  if (row.maxUses != null && row.usedCount >= row.maxUses) return null;
  return row;
}

/**
 * Atomically increment usedCount on the invite. Returns true if the row was
 * updated (i.e. the invite was still valid at the moment we tried to consume).
 */
export async function consumeInvite(token: string): Promise<boolean> {
  const result = await db
    .update(adminInvites)
    .set({ usedCount: sql`${adminInvites.usedCount} + 1` })
    .where(
      and(
        eq(adminInvites.token, token),
        isNull(adminInvites.revokedAt),
        or(
          isNull(adminInvites.expiresAt),
          sql`${adminInvites.expiresAt} > now()`
        ),
        or(
          isNull(adminInvites.maxUses),
          sql`${adminInvites.usedCount} < ${adminInvites.maxUses}`
        )
      )
    )
    .returning({ id: adminInvites.id });
  return result.length > 0;
}
