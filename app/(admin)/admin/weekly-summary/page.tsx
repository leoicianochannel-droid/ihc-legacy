import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Dumbbell, Salad, Flame, TrendingUp, UserPlus, Activity, Heart } from "lucide-react";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  trend?: number;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-3xl font-bold">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <Icon className="size-5 text-primary" />
          </div>
        </div>
        {trend !== undefined && (
          <p className={`mt-2 text-xs font-semibold ${trend >= 0 ? "text-green-600" : "text-red-500"}`}>
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)} vs last week
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default async function WeeklySummaryPage() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); // last Monday
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString();

  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(weekStart.getDate() - 7);
  const prevWeekStartStr = prevWeekStart.toISOString();

  const [
    newMembersThisWeek,
    newMembersPrevWeek,
    workoutsThisWeek,
    workoutsPrevWeek,
    recipesSavedThisWeek,
    ih75Enrollments,
    ih75CheckinsThisWeek,
    activeMembers,
    topRecipes,
    topWorkouts,
  ] = await Promise.all([
    // New members this week
    db.execute(sql`
      SELECT COUNT(*)::int AS n FROM users
      WHERE onboarded_at >= ${weekStartStr} AND clerk_id IS NOT NULL
    `).then((r) => Number((r as unknown as Array<{ n: number }>)[0]?.n ?? 0)).catch(() => 0),

    // New members prev week
    db.execute(sql`
      SELECT COUNT(*)::int AS n FROM users
      WHERE onboarded_at >= ${prevWeekStartStr} AND onboarded_at < ${weekStartStr} AND clerk_id IS NOT NULL
    `).then((r) => Number((r as unknown as Array<{ n: number }>)[0]?.n ?? 0)).catch(() => 0),

    // Workouts logged this week (platform + personal combined)
    db.execute(sql`
      SELECT COUNT(*)::int AS n FROM activity_log
      WHERE type = 'workout_completed' AND created_at >= ${weekStartStr}
    `).then((r) => Number((r as unknown as Array<{ n: number }>)[0]?.n ?? 0)).catch(() => 0),

    // Workouts prev week
    db.execute(sql`
      SELECT COUNT(*)::int AS n FROM activity_log
      WHERE type = 'workout_completed' AND created_at >= ${prevWeekStartStr} AND created_at < ${weekStartStr}
    `).then((r) => Number((r as unknown as Array<{ n: number }>)[0]?.n ?? 0)).catch(() => 0),

    // Recipes saved this week
    db.execute(sql`
      SELECT COUNT(*)::int AS n FROM activity_log
      WHERE type = 'recipe_saved' AND created_at >= ${weekStartStr}
    `).then((r) => Number((r as unknown as Array<{ n: number }>)[0]?.n ?? 0)).catch(() => 0),

    // IH 75 active enrollments
    db.execute(sql`
      SELECT COUNT(*)::int AS n FROM ih75_enrollments WHERE status = 'active'
    `).then((r) => Number((r as unknown as Array<{ n: number }>)[0]?.n ?? 0)).catch(() => 0),

    // IH 75 check-ins this week
    db.execute(sql`
      SELECT COUNT(*)::int AS n FROM ih75_checkins WHERE created_at >= ${weekStartStr}
    `).then((r) => Number((r as unknown as Array<{ n: number }>)[0]?.n ?? 0)).catch(() => 0),

    // Distinct active members this week (any activity)
    db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int AS n FROM activity_log WHERE created_at >= ${weekStartStr}
    `).then((r) => Number((r as unknown as Array<{ n: number }>)[0]?.n ?? 0)).catch(() => 0),

    // Top 5 recipes saved this week
    db.execute(sql`
      SELECT al.reference_id, r.title, COUNT(*)::int AS saves
      FROM activity_log al
      LEFT JOIN recipes r ON r.id::text = al.reference_id
      WHERE al.type = 'recipe_saved' AND al.created_at >= ${weekStartStr} AND r.title IS NOT NULL
      GROUP BY al.reference_id, r.title
      ORDER BY saves DESC
      LIMIT 5
    `).then((r) => r as unknown as Array<{ reference_id: string; title: string; saves: number }>).catch(() => []),

    // Top 5 workouts this week
    db.execute(sql`
      SELECT al.reference_id, w.title, COUNT(*)::int AS completions
      FROM activity_log al
      LEFT JOIN workouts w ON w.id::text = al.reference_id
      WHERE al.type = 'workout_completed' AND al.created_at >= ${weekStartStr} AND w.title IS NOT NULL
      GROUP BY al.reference_id, w.title
      ORDER BY completions DESC
      LIMIT 5
    `).then((r) => r as unknown as Array<{ reference_id: string; title: string; completions: number }>).catch(() => []),
  ]);

  const weekLabel = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-10 md:py-8">
      <div className="mb-6">
        <h1 className="font-display text-4xl font-bold">Weekly Summary</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Week of {weekLabel} · {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* KPI grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="New Members"
          value={newMembersThisWeek}
          sub="joined this week"
          icon={UserPlus}
          trend={newMembersThisWeek - newMembersPrevWeek}
        />
        <StatCard
          label="Workouts Logged"
          value={workoutsThisWeek}
          sub="this week"
          icon={Dumbbell}
          trend={workoutsThisWeek - workoutsPrevWeek}
        />
        <StatCard
          label="Recipes Saved"
          value={recipesSavedThisWeek}
          sub="this week"
          icon={Salad}
        />
        <StatCard
          label="Active Members"
          value={activeMembers}
          sub="logged activity this week"
          icon={Activity}
        />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="IH 75 Enrolled"
          value={ih75Enrollments}
          sub="active participants"
          icon={Flame}
        />
        <StatCard
          label="IH 75 Check-ins"
          value={ih75CheckinsThisWeek}
          sub="this week"
          icon={Heart}
        />
      </div>

      {/* Top content */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Salad className="size-4 text-primary" /> Top Recipes This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topRecipes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recipe activity yet.</p>
            ) : (
              <ol className="space-y-2">
                {topRecipes.map((r, i) => (
                  <li key={r.reference_id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 text-xs font-bold text-muted-foreground">{i + 1}.</span>
                      <span className="truncate font-medium">{r.title}</span>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {r.saves} save{r.saves === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Dumbbell className="size-4 text-primary" /> Top Workouts This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topWorkouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No workout activity yet.</p>
            ) : (
              <ol className="space-y-2">
                {topWorkouts.map((w, i) => (
                  <li key={w.reference_id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 text-xs font-bold text-muted-foreground">{i + 1}.</span>
                      <span className="truncate font-medium">{w.title}</span>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {w.completions}×
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
