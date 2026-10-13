import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Activity,
  Wallet,
  Heart,
  MessageCircle,
  Trophy,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { db, users as usersTable } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  getOverviewMetrics,
  getDailyActivityCounts,
  getCommunityPulse,
  getActivityBreakdown,
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

// Mid-tier MRR target for the progress bar in the top-right card. Adjust
// freely — this is purely a visual milestone.
const MRR_TARGET_USD = 10000;

export default async function AdminOverview() {
  const [{ userId }, m, daily, pulse, breakdown] = await Promise.all([
    auth(),
    getOverviewMetrics(),
    getDailyActivityCounts(30),
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

  // ── Active vs inactive split (last 7d wau / active subs) for the right-side bar.
  const activeShare = m.activeSubs > 0 ? Math.min(1, m.wau / m.activeSubs) : 0;
  const inactiveShare = 1 - activeShare;

  return (
    <div className="px-6 py-8 lg:px-10">
      {/* ── Hero row ──────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left: greeting */}
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Operational Overview
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-tight md:text-5xl">
            Welcome back{firstName ? `, ${firstName}` : ""}
          </h1>
          <div className="mt-4 flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="size-2 rounded-full bg-emerald-500" />
              System Online
            </span>
            <span className="text-xs text-muted-foreground">
              {m.dau} active today · {m.newLast7} new this week
            </span>
          </div>
        </div>

        {/* Right: top summary card */}
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Estimated MRR
              </span>
              <span className="font-display text-2xl font-bold">
                ${m.estMrrUsd.toLocaleString()}
              </span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.min(100, (m.estMrrUsd / MRR_TARGET_USD) * 100)}%`,
                }}
              />
            </div>
            <div className="mt-2 flex items-baseline justify-between text-[10px] text-muted-foreground">
              <span>
                {m.activeSubs} active · {m.trialingSubs} trialing
              </span>
              <span>Goal ${MRR_TARGET_USD.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── KPI grid ──────────────────────────────────────────── */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Kpi
          icon={<Wallet className="size-5" />}
          tint="gold"
          label="Active Subscriptions"
          value={m.activeSubs.toLocaleString()}
          delta={`${m.trialingSubs} trialing · ${m.pastDueSubs} past due`}
        />
        <Kpi
          icon={<Users className="size-5" />}
          tint="green"
          label="Active Community Members"
          value={m.onboardedMembers.toLocaleString()}
          delta={`${m.newLast7} new this week`}
          deltaTone="positive"
        />
        <Kpi
          icon={<Activity className="size-5" />}
          tint="green"
          label="Active This Week"
          value={`${m.wau}${m.totalMembers > 0 ? ` / ${m.totalMembers}` : ""}`}
          delta={
            m.totalMembers > 0
              ? `${Math.round((m.wau / m.totalMembers) * 100)}% of community`
              : undefined
          }
          deltaTone="positive"
        />
        <Kpi
          icon={<TrendingDown className="size-5" />}
          tint={
            m.churnRate30Pct == null
              ? "neutral"
              : m.churnRate30Pct > 8
                ? "rose"
                : m.churnRate30Pct > 4
                  ? "amber"
                  : "green"
          }
          label="Churn (30 days)"
          value={m.churnRate30Pct == null ? "—" : `${m.churnRate30Pct}%`}
          delta={`${m.canceledLast30} canceled in last 30 days`}
        />
      </div>

      {/* ── Activity row ──────────────────────────────────────────── */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Kpi
          icon={<Activity className="size-5" />}
          tint="primary"
          label="Active Today"
          value={m.dau}
          delta={
            m.activeSubs > 0
              ? `${Math.round((m.dau / m.activeSubs) * 1000) / 10}% of subscribers`
              : undefined
          }
        />
        <Kpi
          icon={<MessageCircle className="size-5" />}
          tint="green"
          label="Posts This Week"
          value={pulse.postsLast7}
          delta={`${pulse.commentsLast7} comments · ${pulse.likesLast7} likes`}
        />
        <Kpi
          icon={<Heart className="size-5" />}
          tint="gold"
          label="7-Day Retention"
          value={m.retention7Pct == null ? "—" : `${m.retention7Pct}%`}
          delta="Of last week's signups, this many came back"
          deltaTone={
            m.retention7Pct == null
              ? "neutral"
              : m.retention7Pct >= 50
                ? "positive"
                : m.retention7Pct >= 30
                  ? "amber"
                  : "negative"
          }
        />
      </div>

      {/* ── Breakdown row ──────────────────────────────────────────── */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {/* Activity by type — mirrors the "Cost by API" card in the reference */}
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

        {/* Active vs Inactive split — mirrors the "Text vs Voice" stacked bar */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-baseline justify-between">
              <h3 className="flex items-center gap-2 font-semibold">
                <span className="text-primary">📊</span> Active vs Inactive
              </h3>
              <span className="text-xs text-muted-foreground">Last 7 days</span>
            </div>

            <div className="mt-5">
              <div className="flex h-10 w-full overflow-hidden rounded-full bg-muted">
                {activeShare > 0 && (
                  <div
                    className="flex items-center justify-center bg-primary px-2 text-xs font-bold text-primary-foreground"
                    style={{ width: `${activeShare * 100}%` }}
                  >
                    {activeShare > 0.12 && `${m.wau} active`}
                  </div>
                )}
                {inactiveShare > 0 && (
                  <div
                    className="flex items-center justify-center bg-amber-300 px-2 text-xs font-bold text-amber-900"
                    style={{ width: `${inactiveShare * 100}%` }}
                  >
                    {inactiveShare > 0.12 && `${m.activeSubs - m.wau} inactive`}
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-primary" />
                  Active (last 7d)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-amber-300" />
                  Inactive
                </span>
              </div>
            </div>

            <dl className="mt-5 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Active members</dt>
                <dd>
                  <span className="font-bold">{m.wau}</span>{" "}
                  <span className="text-muted-foreground">
                    @ {m.activeSubs > 0 ? `${Math.round((m.wau / m.activeSubs) * 100)}%` : "—"}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total messages this month</dt>
                <dd>
                  <span className="font-bold">
                    {(pulse.postsLast7 + pulse.commentsLast7).toLocaleString()}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    posts + comments (7d)
                  </span>
                </dd>
              </div>
              <div className="flex justify-between border-t pt-3">
                <dt className="font-semibold">Activation rate</dt>
                <dd className="font-bold">
                  {m.activeSubs > 0
                    ? `${Math.round((m.wau / m.activeSubs) * 100)}%`
                    : "—"}{" "}
                  of subscribers
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* ── Daily activity chart ──────────────────────────────────────────── */}
      <Card className="mt-6 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-baseline justify-between">
            <h3 className="font-semibold">Daily active members</h3>
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

      {/* Retention nudge */}
      {m.retention7Pct != null && m.retention7Pct < 30 && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="size-5 shrink-0" />
          <div>
            <p className="font-semibold">7-day retention is below 30%.</p>
            <p className="mt-0.5 text-xs">
              Consider sending a "you've got this" email to members who don't
              return within 3 days of signup, or a daily reminder push.
            </p>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <QuickLink
          href="/admin/analytics"
          icon={<TrendingUp />}
          title="Analytics"
          subtitle="Engagement, retention, content perf."
        />
        <QuickLink
          href="/admin/members"
          icon={<Users />}
          title="Members"
          subtitle="Search, promote, toggle beta."
        />
        <QuickLink
          href="/admin/content"
          icon={<Trophy />}
          title="Content"
          subtitle="Workouts, recipes, challenges."
        />
        <QuickLink
          href="/admin/invites"
          icon={<ArrowRight />}
          title="Admin invites"
          subtitle="Generate revocable team invites."
        />
      </div>

      <FoundingMemberBonusButton />
    </div>
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
