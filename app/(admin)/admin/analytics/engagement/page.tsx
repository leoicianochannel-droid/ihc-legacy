import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getMemberEngagementList,
  getDropoffMembers,
  getChallengeEngagement,
} from "@/lib/admin-metrics";
import Link from "next/link";
import { ArrowLeft, TrendingDown } from "lucide-react";

export const dynamic = "force-dynamic";

const ACTIVITY_TYPES = [
  { value: "workout_completed", label: "Workouts" },
  { value: "daily_checkin",     label: "Daily Check-ins" },
  { value: "recipe_saved",      label: "Recipes Saved" },
  { value: "post_created",      label: "Posts" },
  { value: "comment_created",   label: "Comments" },
];

const TIMEFRAMES = [
  { value: "7",  label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
];

function fmt(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default async function EngagementPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; days?: string }>;
}) {
  const sp = await searchParams;
  const type = ACTIVITY_TYPES.find((t) => t.value === sp.type)?.value ?? "workout_completed";
  const days = TIMEFRAMES.find((t) => t.value === sp.days)?.value ?? "30";
  const daysNum = parseInt(days, 10);
  const typeLabel = ACTIVITY_TYPES.find((t) => t.value === type)!.label;

  const [members, dropoff, challenges] = await Promise.all([
    getMemberEngagementList(type, daysNum),
    getDropoffMembers(daysNum),
    getChallengeEngagement(),
  ]);

  const maxCount = members[0]?.count ?? 1;

  return (
    <div className="container space-y-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/analytics"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="font-display text-3xl font-bold">Engagement Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Member-level breakdown by activity type and timeframe.
          </p>
        </div>
      </div>

      {/* Filter bar — native GET form, no JS needed */}
      <form method="get" className="flex flex-wrap gap-3 items-center">
        <div className="flex rounded-xl border overflow-hidden">
          {ACTIVITY_TYPES.map((t) => (
            <button
              key={t.value}
              name="type"
              value={t.value}
              type="submit"
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                type === t.value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* Keep current days when changing type */}
        <input type="hidden" name="days" value={days} />

        <div className="flex rounded-xl border overflow-hidden">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              name="days"
              value={tf.value}
              type="submit"
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                days === tf.value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
              }`}
              formAction={`?type=${type}&days=${tf.value}`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </form>

      {/* Member engagement table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">
            {typeLabel} · last {days} days
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {members.length} active members
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No activity in this window.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left w-8">#</th>
                    <th className="px-3 py-2 text-left">Member</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left min-w-[160px]">Activity</th>
                    <th className="px-3 py-2 text-right">Count</th>
                    <th className="px-3 py-2 text-right">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 text-muted-foreground text-xs">{i + 1}</td>
                      <td className="px-3 py-2 font-medium whitespace-nowrap">
                        {m.firstName ?? ""} {m.lastName ?? ""}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{m.email}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${Math.round((m.count / maxCount) * 120)}px`, minWidth: "4px" }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-bold">{m.count}</td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {fmt(m.lastActive)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drop-off section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingDown className="size-4 text-amber-500" />
            Drop-off · active {days}–{daysNum * 2} days ago, quiet since
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              {dropoff.length} members
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {dropoff.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No drop-off detected in this window.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left">Member</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-right">Actions in prev period</th>
                    <th className="px-3 py-2 text-right">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {dropoff.map((m, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium whitespace-nowrap">
                        {m.firstName ?? ""} {m.lastName ?? ""}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{m.email}</td>
                      <td className="px-3 py-2 text-right">{m.prevCount}</td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {fmt(m.lastActive)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Challenge engagement */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Challenge engagement · this week vs last week</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {challenges.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No challenges found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left">Challenge</th>
                    <th className="px-3 py-2 text-right">Enrolled</th>
                    <th className="px-3 py-2 text-right">Active this week</th>
                    <th className="px-3 py-2 text-right">Active last week</th>
                    <th className="px-3 py-2 text-right">Trend</th>
                    <th className="px-3 py-2 text-right">Total check-ins</th>
                  </tr>
                </thead>
                <tbody>
                  {challenges.map((c, i) => {
                    const trend =
                      c.activeLastWeek === 0
                        ? null
                        : Math.round(((c.activeThisWeek - c.activeLastWeek) / c.activeLastWeek) * 100);
                    return (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">{c.title}</td>
                        <td className="px-3 py-2 text-right">{c.enrolled}</td>
                        <td className="px-3 py-2 text-right font-semibold">{c.activeThisWeek}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{c.activeLastWeek}</td>
                        <td className="px-3 py-2 text-right">
                          {trend === null ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : (
                            <span
                              className={`text-xs font-bold ${
                                trend >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
                              }`}
                            >
                              {trend >= 0 ? "+" : ""}{trend}%
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{c.totalCheckins.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
