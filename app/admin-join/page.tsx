import Link from "next/link";
import { cookies } from "next/headers";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import {
  validateInvite,
  ADMIN_INVITE_COOKIE,
} from "@/lib/admin-invites";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

/**
 * Welcome / status page that the cookie-setting route handler redirects to.
 * Reads the invite token from the cookie (no setting!), validates, and
 * shows either the welcome UI or an invalid-link message.
 */
export default async function AdminJoinWelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const Frame = ({ children }: { children: React.ReactNode }) => (
    <div className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-10">
      <Card className="w-full p-8 text-center">{children}</Card>
    </div>
  );

  const jar = await cookies();
  const token = jar.get(ADMIN_INVITE_COOKIE)?.value;
  const invite = token ? await validateInvite(token) : null;

  if (sp.error === "invalid" || !invite) {
    return (
      <Frame>
        <div className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="size-7" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold">
          This invite link isn't valid
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been revoked, expired, or already used. Ask whoever sent
          it to generate a new one.
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link href="/">Back home</Link>
        </Button>
      </Frame>
    );
  }

  // Already signed in? If they're a registered member, surface a one-click
  // "promote me to admin" button instead of forcing them through sign-up again.
  const { userId: clerkId } = await auth();
  let alreadyAdmin = false;
  let alreadySignedIn = false;
  if (clerkId) {
    alreadySignedIn = true;
    const [me] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);
    alreadyAdmin = me?.role === "admin";
  }

  return (
    <Frame>
      <div className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ShieldCheck className="size-7" />
      </div>
      <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-primary">
        Admin access invite
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold">
        You're invited to the Infinity&nbsp;Hoop team
      </h1>
      {invite.label && (
        <p className="mt-2 text-sm font-semibold text-muted-foreground">
          For: {invite.label}
        </p>
      )}
      <p className="mt-3 text-sm text-muted-foreground">
        This link grants admin access to the community platform — you'll be able
        to manage members, content, challenges, and the rest of the back office.
      </p>

      <div className="mt-6">
        {alreadyAdmin ? (
          <Button asChild variant="gradient" size="lg">
            <Link href="/admin">You're already an admin — open admin panel →</Link>
          </Button>
        ) : alreadySignedIn ? (
          <Button asChild variant="gradient" size="lg">
            <Link href="/admin-join/redeem">Claim admin access →</Link>
          </Button>
        ) : (
          <div className="space-y-2">
            <Button asChild variant="gradient" size="lg" className="w-full">
              <Link href="/sign-up">Create your account →</Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link href="/sign-in" className="font-semibold text-primary underline">
                Sign in instead
              </Link>
              .
            </p>
          </div>
        )}
      </div>

      <p className="mt-6 text-[11px] text-muted-foreground">
        {invite.maxUses
          ? `${invite.usedCount}/${invite.maxUses} uses · `
          : "Unlimited uses · "}
        {invite.expiresAt
          ? `expires ${new Date(invite.expiresAt).toLocaleDateString()}`
          : "no expiry"}
      </p>
    </Frame>
  );
}
