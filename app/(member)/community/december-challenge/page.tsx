import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db, users, activityLog } from "@/lib/db";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Star, CheckCircle2, CalendarDays, Gift, HelpCircle } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const CONTEST_START = new Date("2026-12-01T00:00:00.000Z");
const CONTEST_END   = new Date("2026-12-31T23:59:59.999Z");

export default async function DecemberChallengePage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const [me] = await db
    .select({ id: users.id, firstName: users.firstName })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  // Member's December check-in count (if contest is live)
  let myCheckins = 0;
  const now = new Date();
  const contestLive = now >= CONTEST_START && now <= CONTEST_END;

  if (me && contestLive) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(activityLog)
      .where(and(
        eq(activityLog.userId, me.id),
        eq(activityLog.type, "daily_checkin"),
        gte(activityLog.createdAt, CONTEST_START),
        lte(activityLog.createdAt, CONTEST_END),
      ))
      .catch(() => [{ count: 0 }]);
    myCheckins = row?.count ?? 0;
  }

  const daysLeft = contestLive
    ? Math.ceil((CONTEST_END.getTime() - now.getTime()) / 86_400_000)
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">

      {/* Header */}
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
          🏆 December 1–31, 2026
        </div>
        <h1 className="font-display text-3xl font-bold leading-tight md:text-4xl">
          December Flow Challenge
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Complete the 30-minute flow workout as many times as you can this month.
          Two prizes, two ways to win.
        </p>
      </div>

      {/* Prize cards */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="border-amber-300/50 bg-gradient-to-br from-amber-50 to-orange-50 dark:border-amber-700/40 dark:from-amber-950/40 dark:to-orange-950/30">
          <CardContent className="p-5">
            <Trophy className="mb-2 size-6 text-amber-500" />
            <div className="font-display text-2xl font-bold text-amber-700 dark:text-amber-300">$250</div>
            <div className="mt-0.5 text-sm font-semibold text-gray-800 dark:text-amber-100">Most Completions</div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Complete the 30-minute flow workout and check in every day you do it.
              Most check-ins by Dec 31st wins.
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-pink-50 dark:border-primary/20 dark:from-primary/10 dark:to-pink-950/20">
          <CardContent className="p-5">
            <Star className="mb-2 size-6 text-primary" />
            <div className="font-display text-2xl font-bold text-primary">$250</div>
            <div className="mt-0.5 text-sm font-semibold text-gray-800 dark:text-foreground">Best Community Post</div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Share your journey, wins, or breakthroughs in the community.
              The most liked post of the month wins.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* My progress (contest live only) */}
      {contestLive && me && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your check-ins this month</p>
              <p className="font-display text-3xl font-bold text-primary">{myCheckins}</p>
            </div>
            {daysLeft !== null && (
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Days left</p>
                <p className="font-display text-3xl font-bold">{daysLeft}</p>
              </div>
            )}
            <Link
              href="/community"
              className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary/90 transition-colors"
            >
              Go check in →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <div className="mb-6">
        <h2 className="mb-3 font-display text-xl font-bold">How it works</h2>
        <div className="space-y-3">
          {[
            {
              icon: <CalendarDays className="size-4 text-primary shrink-0 mt-0.5" />,
              title: "Watch the 30-minute flow workout",
              body: "Find the December Flow video pinned at the top of the community feed. It was dropped on Black Friday — that's your workout for the month.",
            },
            {
              icon: <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />,
              title: "Check in every time you complete it",
              body: "After each session, log your daily check-in. Every single check-in counts toward the Most Completions prize — there's no cap.",
            },
            {
              icon: <Star className="size-4 text-primary shrink-0 mt-0.5" />,
              title: "Post about your journey",
              body: "Share a win, a hard day, a before/after, anything real. The most liked post from any member in December wins the Best Community Post prize.",
            },
            {
              icon: <Gift className="size-4 text-amber-500 shrink-0 mt-0.5" />,
              title: "Winners announced January 2nd",
              body: "Both winners will be announced in the community and contacted directly. Prizes paid within 7 days of announcement.",
            },
          ].map((step) => (
            <div key={step.title} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
              {step.icon}
              <div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="mb-8">
        <h2 className="mb-3 font-display text-xl font-bold flex items-center gap-2">
          <HelpCircle className="size-5 text-muted-foreground" />
          Common questions
        </h2>
        <div className="space-y-3">
          {[
            {
              q: "Do I have to do the workout every single day?",
              a: "Nope. Do it as many times as you can — even a few completions puts you in the running. Consistency wins, but there's no minimum.",
            },
            {
              q: "Can I win both prizes?",
              a: "Yes! One member can win both the Most Completions and Best Community Post prizes if they earn it.",
            },
            {
              q: "What counts as a check-in?",
              a: "Your daily check-in logged in the app after completing the 30-minute flow. Only check-ins made between December 1st and December 31st count.",
            },
            {
              q: "How is the Best Community Post winner picked?",
              a: "The post with the most likes from any member (not just the team) posted between December 1st and December 31st wins. You can post about anything — your progress, a win, how you're feeling, a transformation. Real beats polished.",
            },
            {
              q: "How do I get paid if I win?",
              a: "We'll reach out directly after the announcement to arrange payment. We use Venmo, PayPal, or a gift card — your choice.",
            },
            {
              q: "I joined after December 1st — am I eligible?",
              a: "Yes! Active members who join any time in December are eligible. Your check-ins start counting from your first day.",
            },
          ].map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-border bg-card"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold list-none">
                {item.q}
                <span className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180">▾</span>
              </summary>
              <p className="border-t border-border px-4 pb-4 pt-3 text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>

      {/* Back link */}
      <Link href="/community" className="text-sm font-semibold text-primary hover:underline">
        ← Back to community
      </Link>
    </div>
  );
}
