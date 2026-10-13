import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  ADMIN_INVITE_COOKIE,
  consumeInvite,
  validateInvite,
} from "@/lib/admin-invites";

export const dynamic = "force-dynamic";

/**
 * Redeem flow for an already-signed-in user. Reads the invite token from the
 * cookie set by /admin-join/[token], validates + consumes it, promotes the
 * current user to admin, and routes them to /admin.
 *
 * Brand-new sign-ups don't pass through here — onboarding handles them
 * directly because role assignment happens at user creation.
 */
export default async function RedeemAdminInvitePage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const jar = await cookies();
  const token = jar.get(ADMIN_INVITE_COOKIE)?.value;
  if (!token) redirect("/dashboard");

  const invite = await validateInvite(token);
  if (!invite) {
    jar.delete(ADMIN_INVITE_COOKIE);
    redirect("/dashboard");
  }

  // Promote the user. Idempotent — if they're already admin we just clear
  // the cookie and bounce them to the admin panel.
  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) redirect("/onboarding");

  if (me.role !== "admin") {
    const ok = await consumeInvite(token);
    if (ok) {
      await db.update(users).set({ role: "admin" }).where(eq(users.id, me.id));
    }
  }

  jar.delete(ADMIN_INVITE_COOKIE);
  redirect("/admin");
}
