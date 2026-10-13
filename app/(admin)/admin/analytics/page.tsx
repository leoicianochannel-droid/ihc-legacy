import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Activity, Users, AlertTriangle } from "lucide-react";
import Link from "next/link";
import {
  getDailyActivityCounts,
  getActivityBreakdown,
  getSignupsByDay,
} from "@/lib/admin-metrics";
import { BarSeries, HorizontalBars } from "@/components/admin/charts";

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

export default async function AdminAnalyticsPage() {
  const [daily30, daily90, breakdown30, signups30] = await Promise.all([
    getDailyActivityCounts(30),
    getDailyActivityCounts(90),
    getActivityBreakdown(30),
    getSignupsByDay(30),
  ]);

  const breakdownRows = breakdown30.map((b) => ({
    label: ACTIVITY_LABELS[b.type] ?? b.type,
    count: b.count,
  }));

  return (
    <div className="container space-y-6 py-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Engagement, growth, and content performance. Updated live from the database.
        </p>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/analytics/engagement"
          className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
        >
          <Users className="size-4 text-primary" />
          Member engagement breakdown →
        </Link>
        <Link
          href="/admin/analytics/top-members"
          className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
        >
          <BarChart3 className="size-4 text-primary" />
          Top 50 members →
        </Link>
        <Link
          href="/admin/analytics/churn-risk"
          className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
        >
          <AlertTriangle className="size-4 text-amber-500" />
          Churn risk list →
        </Link>
        <Link
          href="/admin/analytics/migration-lag"
          className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
        >
          <Users className="size-4 text-blue-500" />
          Migration lag report →
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="size-4 text-primary" /> Daily active users · last 30 days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BarSeries data={daily30} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="size-4 text-primary" /> Daily active users · last 90 days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BarSeries data={daily90} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="size-4 text-primary" /> New sign-ups · last 30 days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BarSeries
            data={signups30}
            emptyLabel="No new sign-ups in this window."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="size-4 text-primary" /> Activity mix · last 30 days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <HorizontalBars
            rows={breakdownRows}
            emptyLabel="No activity events logged yet."
          />
          <p className="mt-3 text-xs text-muted-foreground">
            What members are actually doing. Workouts and check-ins drive
            retention; posts and comments drive habit-formation through
            community.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
