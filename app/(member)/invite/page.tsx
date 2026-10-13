import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db, users, referrals } from "@/lib/db";
import { eq, count } from "drizzle-orm";
import { getAppUrl } from "@/lib/app-url";
import { ensureReferralCode } from "@/lib/referrals";
import { InviteCopyCard } from "./invite-copy-card";

export default async function InvitePage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) redirect("/onboarding");

  const [{ total }] = await db
    .select({ total: count() })
    .from(referrals)
    .where(eq(referrals.referrerUserId, me.id));

  const code = me.referralCode ?? (await ensureReferralCode(me.id));
  const referralUrl = code ? `${getAppUrl()}/join?ref=${code}` : null;

  return (
    <div className="mx-auto max-w-xl px-4 py-8 md:px-10">
      <h1 className="font-display text-4xl font-bold">Invite a Friend</h1>
      <p className="mt-2 text-muted-foreground">
        Know someone who could use an accountability partner? Share your link and
        they'll get started right away.
      </p>

      <InviteCopyCard referralUrl={referralUrl} referredCount={Number(total)} />

      <div className="mt-8 rounded-2xl border bg-muted/30 p-5 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">How it works</p>
        <ul className="mt-3 space-y-2">
          <li>1. Copy your personal invite link below.</li>
          <li>2. Share it with friends — Instagram, text, email, DMs, wherever.</li>
          <li>3. When they sign up through your link, you're automatically linked as their referrer.</li>
          <li>4. Keep an eye on this page to see how many friends you've brought in.</li>
        </ul>
      </div>
    </div>
  );
}
