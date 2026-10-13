import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Activity,
  Wallet,
  Heart,
  Trophy,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { db, users as usersTable } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  getOverviewMetrics,
  getCommunityPulse,
  getActivityBreakdown,
  getCommunityHealth,
  getDailyActiveMembers,
} from "@/lib/admin-metrics";
import { BarSeries } from "@/components/admin/charts";
import { FoundingMemberBonusButton } from "./founding-member-bonus-button";

export const dynamic = "force-dynamic";

const ACTIVITY_LABELS: Record<string, string> = {
  workout_completed: "Workouts completed",
  recipe_saved: "Recipes saved",
  daily_checkin: "Daily check-ins",
  post_created: "Posts created",
  comment_created: "Comments created",
  challenge_day_completed: "Challenge days completed",
  buddy_checkin: "Buddy check-ins",
};

function share(n: number, d: number) {
  return d > 0 ? `${Math.round((n / d) * 1000) / 10}%` : "—";
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function AdminOverview() {
  const [{ userId }, m, h, daily, pulse, breakdown] = await Promise.all([
    auth(),
    getOverviewMetrics(),
    getCommunityHealth(6),
    getDailyActiveMembers(30),
    getCommunityPulse(),
    getActivityBreakdown(30),
  ]);

  let firstName: string | null = null;
  if (userId) {
    const [me] = await db
      .select({ firstName: usersTable.firstName })
      .from(usersTable)
      .where(eq(usersTable.clerkId, userId))
      .limit(1);
    firstName = me?.firstName ?? null;
  }

  // Paying vs churned split (all-time, community members only).
  const everPaid = h.paying + h.churnedAllTime;
  const stayingShare = everPaid > 0 ? h.paying / everPaid : 0;

  return (
    <div className="px-6 py-8 lg:px-10">
      {/* ── Hero row ──────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Community Health
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-tight md:text-5xl">
            Welcome back{firstName ? `, ${firstName}` : ""}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="size-2 rounded-full bg-emerald-500" />
              System Online
            </span>
            <span className="text-xs text-muted-foreground">
              Every number on this page counts only members who joined the
              community app. {h.nonCommunitySubs.toLocaleString()} other Skio
              subscriptions are excluded.
            </span>
          </div>
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Community MRR (est.)
              </span>
              <span className="font-display text-2xl font-bold">
                ${h.estMrrUsd.toLocaleString()}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {(h.paying - h.trialing).toLocaleString()} paying members × $
              {h.pricePerMemberUsd}/mo. Trials and comped members not included.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Are people staying? ──────────────────────────────────── */}
      <SectionTitle>Are members staying?</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<Wallet className="size-5" />}
          tint="green"
          label="Paying community members"
          value={h.paying.toLocaleString()}
          delta={`${h.trialing} trialing · ${h.pastDue} past due · ${h.comp} comped`}
        />
        <Kpi
          icon={<TrendingDown className="size-5" />}
          tint={
            h.churnRate30Pct == null
              ? "neutral"
              : h.churnRate30Pct > 8
                ? "rose"
                : h.churnRate30Pct > 4
                  ? "amber"
                  : "green"
          }
          label="Churn (last 30 days)"
          value={h.churnRate30Pct == null ? "—" : `${h.churnRate30Pct}%`}
          delta={`${h.churnedLast30.toLocaleString()} members canceled`}
        />
        <Kpi
          icon={<Users className="size-5" />}
          tint="primary"
          label="New paying (last 30 days)"
          value={h.newPayingLast30.toLocaleString()}
          delta={`Net ${h.netChangeLast30 >= 0 ? "+" : ""}${h.netChangeLast30.toLocaleString()} after churn`}
          deltaTone={h.netChangeLast30 >= 0 ? "positive" : "negative"}
        />
        <Kpi
          icon={<Heart className="size-5" />}
          tint="gold"
          label="Still here (all time)"
          value={share(h.paying, everPaid)}
          delta={`${h.paying.toLocaleString()} staying · ${h.churnedAllTime.toLocaleString()} churned`}
        />
      </div>

      {/* ── Are they showing up? ─────────────────────────────────── */}
      <SectionTitle>Are paying members showing up?</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<Activity className="size-5" />}
          tint="primary"
          label="Active today"
          value={h.dau.toLocaleString()}
          delta={`${share(h.dau, h.paying)} of paying members`}
        />
        <Kpi
          icon={<Trophy className="size-5" />}
          tint="green"
          label="Daily regulars"
          value={h.dailyRegulars.toLocaleString()}
          delta={`Active 5+ of the last 7 days · ${share(h.dailyRegulars, h.paying)}`}
          deltaTone="positive"
        />
        <Kpi
          icon={<Activity className="size-5" />}
          tint="green"
          label="Active this week / month"
          value={`${h.wau.toLocaleString()} / ${h.mau.toLocaleString()}`}
          delta={`${share(h.wau, h.paying)} weekly · ${share(h.mau, h.paying)} monthly`}
        />
        <Kpi
          icon={<AlertTriangle className="size-5" />}
          tint="rose"
          label="Paying but not using it"
          value={(h.goneQuiet14 + h.neverActive).toLocaleString()}
          delta={`${h.goneQuiet14.toLocaleString()} quiet 14+ days · ${h.neverActive.toLocaleString()} never active`}
          deltaTone="negative"
        />
      </div>

      {/* ── Paying vs churned + monthly churn ───────────────────────── */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold">Monthly churn</h3>
              <span className="text-xs text-muted-foreground">
                Community members only
              </span>
            </div>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Month</th>
                  <th className="pb-2 text-right font-medium">Paying at start</th>
                  <th className="pb-2 text-right font-medium">Joined</th>
                  <th className="pb-2 text-right font-medium">Canceled</th>
                  <th className="pb-2 text-right font-medium">Churn</th>
                </tr>
              </thead>
              <tbody>
                {h.churnByMonth.map((r, i) => (
                  <tr key={r.month} className="border-t">
                    <td className="py-2">
                      {monthLabel(r.month)}
                      {i === 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">(so far)</span>
                      )}
                    </td>
                    <td className="py-2 text-right">{r.startPaying.toLocaleString()}</td>
                    <td className="py-2 text-right text-emerald-700">+{r.joined.toLocaleString()}</td>
                    <td className="py-2 text-right text-rose-700">−{r.churned.toLocaleString()}</td>
                    <td className="py-2 text-right font-bold">
                      {r.churnPct == null ? "—" : `${r.churnPct}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Churn = members who canceled that month ÷ members paying on the 1st.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold">Retention by join month</h3>
              <span className="text-xs text-muted-foreground">As of today</span>
            </div>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Joined</th>
                  <th className="pb-2 text-right font-medium">Members</th>
                  <th className="pb-2 text-right font-medium">Still paying</th>
                  <th className="pb-2 text-right font-medium">Active last 30d</th>
                </tr>
              </thead>
              <tbody>
                {h.cohorts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-3 text-muted-foreground">
                      No members joined in this window.
                    </td>
                  </tr>
                ) : (
                  h.cohorts.map((c) => (
                    <tr key={c.month} className="border-t">
                      <td className="py-2">{monthLabel(c.month)}</td>
                      <td className="py-2 text-right">{c.joined.toLocaleString()}</td>
                      <td className="py-2 text-right font-bold">
                        {c.stillPayingPct == null ? "—" : `${c.stillPayingPct}%`}
                      </td>
                      <td className="py-2 text-right">
                        {c.activeLast30Pct == null ? "—" : `${c.activeLast30Pct}%`}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Of the members who finished onboarding in each month, how many still
              pay and how many used the app in the last 30 days.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Daily active chart ──────────────────────────────────────────── */}
      <Card className="mt-6 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-baseline justify-between">
            <h3 className="font-semibold">Paying members active each day</h3>
            <span className="text-xs text-muted-foreground">Last 30 days</span>
          </div>
          <div className="mt-4">
            <BarSeries
              data={daily}
              emptyLabel="No activity logged yet — this fills in once members complete workouts."
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Engagement detail ──────────────────────────────────────────── */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-baseline justify-between">
              <h3 className="flex items-center gap-2 font-semibold">
                <span className="text-primary">⚡</span> Engagement by Type
              </h3>
              <span className="text-xs text-muted-foreground">Last 30 days</span>
            </div>

            <div className="mt-5 space-y-4">
              {breakdown.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  No activity events yet. Members' first workouts will start
                  showing up here.
                </p>
              ) : (
                breakdown.slice(0, 5).map((row) => {
                  const max = Math.max(...breakdown.map((b) => b.count));
                  const pct = max > 0 ? (row.count / max) * 100 : 0;
                  return (
                    <div key={row.type} className="space-y-1.5">
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-medium">
                          {ACTIVITY_LABELS[row.type] ?? row.type}
                        </span>
                        <span className="font-bold">
                          {row.count.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-5 flex items-baseline justify-between border-t pt-3">
              <span className="font-semibold">Total events</span>
              <span className="font-display text-xl font-bold">
                {breakdown.reduce((sum, b) => sum + b.count, 0).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-baseline justify-between">
              <h3 className="flex items-center gap-2 font-semibold">
                <span className="text-primary">📊</span> Staying vs Churned
              </h3>
              <span className="text-xs text-muted-foreground">All time</span>
            </div>

            <div className="mt-5">
              <div className="flex h-10 w-full overflow-hidden rounded-full bg-muted">
                {stayingShare > 0 && (
                  <div
                    className="flex items-center justify-center bg-primary px-2 text-xs font-bold text-primary-foreground"
                    style={{ width: `${stayingShare * 100}%` }}
                  >
                    {stayingShare > 0.12 && `${h.paying.toLocaleString()} staying`}
                  </div>
                )}
                {stayingShare < 1 && everPaid > 0 && (
                  <div
                    className="flex items-center justify-center bg-amber-300 px-2 text-xs font-bold text-amber-900"
                    style={{ width: `${(1 - stayingShare) * 100}%` }}
                  >
                    {1 - stayingShare > 0.12 && `${h.churnedAllTime.toLocaleString()} churned`}
                  </div>
                )}
              </div>
            </div>

            <dl className="mt-5 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Community members (onboarded)</dt>
                <dd className="font-bold">{h.members.toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Posts / comments / likes (7d)</dt>
                <dd className="font-bold">
                  {pulse.postsLast7} / {pulse.commentsLast7} / {pulse.likesLast7}
                </dd>
              </div>
              <div className="flex justify-between border-t pt-3">
                <dt className="font-semibold">7-day retention (new members)</dt>
                <dd className="font-bold">
                  {m.retention7Pct == null ? "—" : `${m.retention7Pct}%`}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* ── How these numbers are calculated ─────────────────────────── */}
      <details className="mt-6 rounded-2xl border bg-card p-5 text-sm">
        <summary className="cursor-pointer font-semibold">
          How these numbers are calculated
        </summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
          <li>
            <b>Community member</b>: created an app account and finished
            onboarding. Admins and coaches are excluded. Skio subscribers who
            never joined the app are not counted anywhere on this page.
          </li>
          <li>
            <b>Paying</b>: has a Skio subscription that is active, trialing or
            past due. <b>Churned</b>: has a canceled subscription and nothing
            currently paying. The cancel date is when the subscription row
            last changed to canceled.
          </li>
          <li>
            <b>Active</b>: did something in the app that day (a workout,
            check-in, post, comment, recipe save or challenge day). Just
            opening the app and browsing isn't tracked yet.
          </li>
          <li>
            <b>Community MRR</b>: paying members, minus trials, × $
            {h.pricePerMemberUsd}/mo. This is an estimate. Discounts and plan
            differences aren't taken into account.
          </li>
        </ul>
      </details>

      {/* Quick links */}
      <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <QuickLink
          href="/admin/analytics"
          icon={<TrendingUp />}
          title="Analytics"
          subtitle="Engagement, retention, content perf."
        />
        <QuickLink
          href="/admin/analytics/churn-risk"
          icon={<AlertTriangle />}
          title="Churn risk"
          subtitle="Members going quiet."
        />
        <QuickLink
          href="/admin/members"
          icon={<Users />}
          title="Members"
          subtitle="Search, promote, toggle beta."
        />
        <QuickLink
          href="/admin/content"
          icon={<ArrowRight />}
          title="Content"
          subtitle="Workouts, recipes, challenges."
        />
      </div>

      <FoundingMemberBonusButton />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-8 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </h2>
  );
}

// ─── Components ────────────────────────────────────────────────────

type Tint = "primary" | "gold" | "green" | "amber" | "rose" | "neutral";

const TINT_CLASSES: Record<Tint, { bg: string; fg: string }> = {
  primary: { bg: "bg-primary/10", fg: "text-primary" },
  gold: { bg: "bg-amber-100", fg: "text-amber-700" },
  green: { bg: "bg-emerald-100", fg: "text-emerald-700" },
  amber: { bg: "bg-amber-100", fg: "text-amber-700" },
  rose: { bg: "bg-rose-100", fg: "text-rose-700" },
  neutral: { bg: "bg-muted", fg: "text-foreground/60" },
};

function Kpi({
  icon,
  tint = "primary",
  label,
  value,
  delta,
  deltaTone = "neutral",
}: {
  icon: React.ReactNode;
  tint?: Tint;
  label: string;
  value: string | number;
  delta?: string | null;
  deltaTone?: "positive" | "negative" | "neutral" | "amber";
}) {
  const t = TINT_CLASSES[tint];
  const deltaClass =
    deltaTone === "positive"
      ? "text-emerald-600"
      : deltaTone === "negative"
        ? "text-rose-600"
        : deltaTone === "amber"
          ? "text-amber-600"
          : "text-muted-foreground";
  return (
    <Card className="shadow-sm">
      <CardContent className="p-5">
        <div className={`inline-flex size-10 items-center justify-center rounded-xl ${t.bg} ${t.fg}`}>
          {icon}
        </div>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 font-display text-3xl font-bold leading-tight">
          {value}
        </p>
        {delta && (
          <p className={`mt-1.5 flex items-center gap-1 text-xs font-semibold ${deltaClass}`}>
            {deltaTone === "positive" && <TrendingUp className="size-3" />}
            {deltaTone === "negative" && <TrendingDown className="size-3" />}
            {delta}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function QuickLink({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
        <CardContent className="flex h-full flex-col p-4">
          <div className="flex items-center gap-2 text-primary">
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary/10">
              {icon}
            </span>
            <span className="font-semibold text-foreground">{title}</span>
            <ArrowRight className="ml-auto size-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{subtitle}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
