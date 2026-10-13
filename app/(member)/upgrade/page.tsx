import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db, users, referrals, premiumWaitlist } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gift, Sparkles, Trophy, Users, Video, Brain, MessageCircle, Crown } from "lucide-react";
import { ensureReferralCode } from "@/lib/referrals";
import { getAppUrl } from "@/lib/app-url";
import { ShareReferralBlock } from "./share-referral-block";
import { PremiumWaitlistForm } from "./premium-waitlist-form";

export const dynamic = "force-dynamic";

export default async function UpgradePage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) redirect("/onboarding");

  const referralCode = me.referralCode ?? (await ensureReferralCode(me.id));

  // Stats for the referral card
  const referralStats = await db
    .select({
      total: sql<number>`count(*)::int`,
      activated: sql<number>`count(*) filter (where status = 'activated')::int`,
      rewarded: sql<number>`count(*) filter (where status = 'rewarded')::int`,
    })
    .from(referrals)
    .where(eq(referrals.referrerUserId, me.id));
  const stats = referralStats[0] ?? { total: 0, activated: 0, rewarded: 0 };

  // Have they already joined the waitlist?
  const [existingWaitlist] = await db
    .select()
    .from(premiumWaitlist)
    .where(eq(premiumWaitlist.userId, me.id))
    .limit(1);

  const shareLink = `${getAppUrl()}/sign-up?ref=${referralCode}`;

  return (
    <div className="relative">
      <div className="absolute inset-0 hoop-gradient opacity-30" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-6 py-10">
        {/* Hero */}
        <div className="text-center">
          <Badge variant="gold" className="uppercase tracking-wider">
            <Sparkles className="mr-1 size-3" /> Unlock more
          </Badge>
          <h1 className="mt-4 font-display text-4xl font-bold md:text-5xl">
            Get more from Infinity Hoop
          </h1>
          <p className="mx-auto mt-3 max-w-3xl text-muted-foreground">
            Share with the women in your life. Or level up your membership
            with 1:1 coaching. Both build the community — and your results.
          </p>
        </div>

        {/* Gift / referral card */}
        <Card className="mt-10 overflow-hidden">
          <div className="relative grid gap-0 md:grid-cols-[1fr_1.2fr]">
            {/* Left: gradient banner */}
            <div className="relative hoop-gradient-bold p-8 text-white md:p-10">
              <Gift className="size-10" />
              <h2 className="mt-4 font-display text-3xl font-bold">
                Gift a friend,<br /> you both get a month free
              </h2>
              <p className="mt-3 text-white/90">
                Every friend who joins Infinity Hoop with your code gets their
                first month free. And we give you a free month too — it's our
                favorite way to grow the community.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-white/15 p-3 text-center backdrop-blur">
                  <div className="font-display text-2xl font-bold">{stats.total}</div>
                  <div className="text-[10px] uppercase tracking-wider text-white/80">Invites</div>
                </div>
                <div className="rounded-xl bg-white/15 p-3 text-center backdrop-blur">
                  <div className="font-display text-2xl font-bold">{stats.activated}</div>
                  <div className="text-[10px] uppercase tracking-wider text-white/80">Joined</div>
                </div>
                <div className="rounded-xl bg-white/15 p-3 text-center backdrop-blur">
                  <div className="font-display text-2xl font-bold">{stats.rewarded}</div>
                  <div className="text-[10px] uppercase tracking-wider text-white/80">Free months</div>
                </div>
              </div>
            </div>

            {/* Right: share block */}
            <div className="p-8 md:p-10">
              <ShareReferralBlock code={referralCode} shareLink={shareLink} firstName={me.firstName ?? "friend"} />
            </div>
          </div>
        </Card>

        {/* Premium tier card */}
        <Card className="mt-6 overflow-hidden border-primary ring-2 ring-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge variant="gold" className="uppercase tracking-wider">
                  <Crown className="mr-1 size-3" /> Coming soon
                </Badge>
                <CardTitle className="mt-3 text-3xl">Infinity Hoop Premium</CardTitle>
                <p className="mt-2 text-muted-foreground">
                  White-glove coaching for members who want a personal plan and
                  a real coach in their corner.
                </p>
              </div>
              <div className="text-right">
                <div className="font-display text-5xl font-bold hoop-text-gradient">$99</div>
                <div className="text-xs text-muted-foreground">/month</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                {
                  icon: MessageCircle,
                  title: "Weekly 1:1 coach check-in",
                  body: "Send your weekly update. Get personalized feedback within 48 hours from a trained Infinity Hoop coach.",
                },
                {
                  icon: Video,
                  title: "Monthly Zoom coaching call",
                  body: "A private 30-minute video call every month to adjust your plan and stay accountable.",
                },
                {
                  icon: Brain,
                  title: "AI-personalized plan",
                  body: "A workout + meal plan built for your body, schedule, goals, and injuries. Updates as you progress.",
                },
              ].map((f) => (
                <div key={f.title} className="rounded-xl border bg-muted/40 p-4">
                  <div className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <f.icon className="size-4" />
                  </div>
                  <div className="mt-3 font-display font-bold">{f.title}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border bg-card p-5">
              {existingWaitlist ? (
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Trophy className="size-5" />
                  </div>
                  <div>
                    <div className="font-display text-lg font-bold">You're on the list ✨</div>
                    <div className="text-sm text-muted-foreground">
                      We'll email you as soon as Premium opens.
                    </div>
                  </div>
                </div>
              ) : (
                <PremiumWaitlistForm defaultEmail={me.email} />
              )}
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Questions about upgrades? DM us on Instagram{" "}
          <a href="https://instagram.com/infinityhoop" className="underline hover:text-foreground" target="_blank" rel="noreferrer">
            @infinityhoop
          </a>
          .
        </p>
      </div>
    </div>
  );
}
