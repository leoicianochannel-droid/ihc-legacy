import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db, users, streaks, workouts, recipes, challengeMembers, challenges, activityLog, posts, buddyMatches, memberPlans } from "@/lib/db";
import { eq, and, desc, sql, count, or } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { StreakCard } from "@/components/member/streak-card";
import { TierCard } from "@/components/member/tier-card";
import { GettingStartedCard } from "@/components/member/getting-started-card";
import { CheckInButton } from "@/components/member/check-in-button";
import { SaveRecipeButton } from "@/components/member/save-recipe-button";
import { PlayCircle, Trophy, Lightbulb, ChevronRight } from "lucide-react";
import { LivePill } from "@/components/live/live-pill";
import { PushPromptBanner } from "@/components/pwa/push-prompt-banner";
import { todayInTz, getWeekStart } from "@/lib/utils";
import { thumbnailUrl as cfThumbnail } from "@/lib/cloudflare-stream";
import { getTierStats, type Tier } from "@/lib/tiers";
import { getGettingStartedStatus } from "@/lib/getting-started";
import type { GeneratedPlan, PlanWeek, PlanWorkoutRef, PlanRecipeRef } from "@/lib/plan-types";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [dbUser] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (!dbUser) redirect("/onboarding");
  if (!dbUser.onboardedAt) redirect("/onboarding");
  if (!dbUser.planCompletedAt) redirect("/plan-setup");

  // Pull user's streak, plan data, and other page-level data in parallel.
  const [streak, planRow, tierStats, gettingStarted] = await Promise.all([
    db.select().from(streaks).where(eq(streaks.userId, dbUser.id)).limit(1).then((r) => r[0] ?? null),
    db.select().from(memberPlans).where(eq(memberPlans.userId, dbUser.id)).limit(1).then((r) => r[0] ?? null),
    getTierStats(dbUser.id),
    getGettingStartedStatus(dbUser.id),
  ]);

  // ── Parse plan and compute today's workout/recipe ─────────────────────────
  let planWeekData: PlanWeek | null = null;
  let planWeekNum = 1;
  let planWorkoutRef: PlanWorkoutRef | null = null;
  let planRecipeRef: PlanRecipeRef | null = null;

  if (planRow) {
    const plan = planRow.plan as GeneratedPlan;
    // Use createdAt (never reset) rather than startedAt (reset on regeneration)
    const planStart = new Date(planRow.createdAt ?? planRow.startedAt);
    const dayOfPlan = Math.max(
      0,
      Math.floor((Date.now() - planStart.getTime()) / (1000 * 60 * 60 * 24))
    );
    const weekIndex = Math.min(Math.floor(dayOfPlan / 7), plan.weeks.length - 1);
    planWeekData = plan.weeks[weekIndex] ?? null;
    planWeekNum = planWeekData?.week ?? weekIndex + 1;
    const dayWithinWeek = dayOfPlan % 7;

    if (planWeekData) {
      planWorkoutRef = planWeekData.workouts.length > 0
        ? planWeekData.workouts[dayWithinWeek % planWeekData.workouts.length]
        : null;
      planRecipeRef = planWeekData.recipes.length > 0
        ? planWeekData.recipes[dayWithinWeek % planWeekData.recipes.length]
        : null;
    }
  }

  // Fetch the plan's workout and recipe (with generic fallbacks) in parallel.
  const [planWorkoutRows, fallbackWorkoutRows, planRecipeRows, fallbackRecipeRows] = await Promise.all([
    planWorkoutRef
      ? db.select().from(workouts).where(eq(workouts.id, planWorkoutRef.workoutId)).limit(1)
      : Promise.resolve([] as typeof workouts.$inferSelect[]),
    db.select().from(workouts)
      .where(dbUser.fitnessLevel ? eq(workouts.intensity, dbUser.fitnessLevel) : undefined)
      .limit(1),
    planRecipeRef
      ? db.select().from(recipes).where(eq(recipes.id, planRecipeRef.recipeId)).limit(1)
      : Promise.resolve([] as typeof recipes.$inferSelect[]),
    db.select().from(recipes).limit(1),
  ]);

  const todayWorkout = planWorkoutRows[0] ?? fallbackWorkoutRows[0] ?? null;
  const todayRecipe  = planRecipeRows[0]  ?? fallbackRecipeRows[0]  ?? null;

  const activeChallenges = await db
    .select({
      challenge: challenges,
      member: challengeMembers,
    })
    .from(challengeMembers)
    .innerJoin(challenges, eq(challenges.id, challengeMembers.challengeId))
    .where(
      and(
        eq(challengeMembers.userId, dbUser.id),
        eq(challenges.isActive, true)
      )
    )
    .orderBy(desc(challengeMembers.startedAt))
    .limit(1);

  const tz = dbUser.timezone ?? "America/New_York";
  const today = todayInTz(tz);
  const weekStart = getWeekStart(tz);
  const lastActionToday = streak?.lastActionDate
    ? String(streak.lastActionDate) === today
    : false;

  // Was today's workout already completed today (in user's timezone)?
  let todayWorkoutCompleted = false;
  if (todayWorkout) {
    const [hit] = await db
      .select({ id: activityLog.id })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.userId, dbUser.id),
          eq(activityLog.type, "workout_completed"),
          eq(activityLog.referenceId, todayWorkout.id),
          sql`(${activityLog.createdAt} AT TIME ZONE ${tz})::date = ${today}::date`
        )
      )
      .limit(1);
    todayWorkoutCompleted = !!hit;
  }

  // Has the user already checked in today?
  const [checkinHit] = await db
    .select({ id: activityLog.id })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.userId, dbUser.id),
        eq(activityLog.type, "daily_checkin"),
        sql`(${activityLog.createdAt} AT TIME ZONE ${tz})::date = ${today}::date`
      )
    )
    .limit(1);
  const checkedInToday = !!checkinHit;

  // Has today's recipe already been saved this week?
  let recipeSavedThisWeek = false;
  if (todayRecipe) {
    const [savedHit] = await db
      .select({ id: activityLog.id })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.userId, dbUser.id),
          eq(activityLog.type, "recipe_saved"),
          eq(activityLog.referenceId, todayRecipe.id),
          sql`(${activityLog.createdAt} AT TIME ZONE ${tz})::date >= ${weekStart}::date`
        )
      )
      .limit(1);
    recipeSavedThisWeek = !!savedHit;
  }

  // Recent community posts preview + this-week stats — all in parallel
  const [recentPosts, workoutsThisWeek, recipesThisWeek, checkinsThisWeek] = await Promise.all([
    db
      .select({ post: posts, author: users })
      .from(posts)
      .leftJoin(users, eq(users.id, posts.userId))
      .orderBy(desc(posts.createdAt))
      .limit(3),
    db
      .select({ n: count() })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.userId, dbUser.id),
          eq(activityLog.type, "workout_completed"),
          sql`(${activityLog.createdAt} AT TIME ZONE ${tz})::date >= ${weekStart}::date`
        )
      )
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: count() })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.userId, dbUser.id),
          eq(activityLog.type, "recipe_saved"),
          sql`(${activityLog.createdAt} AT TIME ZONE ${tz})::date >= ${weekStart}::date`
        )
      )
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: count() })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.userId, dbUser.id),
          eq(activityLog.type, "daily_checkin"),
          sql`(${activityLog.createdAt} AT TIME ZONE ${tz})::date >= ${weekStart}::date`
        )
      )
      .then((r) => r[0]?.n ?? 0),
  ]);

  const weeklyWorkoutTarget = Math.ceil((dbUser.weeklyTargetMinutes ?? 120) / 25);

  // Accountability buddy
  const [buddyRow] = await db
    .select({ match: buddyMatches, partner: users })
    .from(buddyMatches)
    .leftJoin(
      users,
      or(
        and(eq(buddyMatches.userAId, dbUser.id), eq(users.id, buddyMatches.userBId)),
        and(eq(buddyMatches.userBId, dbUser.id), eq(users.id, buddyMatches.userAId))
      )
    )
    .where(
      and(
        or(eq(buddyMatches.userAId, dbUser.id), eq(buddyMatches.userBId, dbUser.id)),
        eq(buddyMatches.status, "active")
      )
    )
    .limit(1);
  const buddy = buddyRow?.partner ?? null;

  const workoutHref = todayWorkout ? `/workouts/${todayWorkout.slug}` : "/workouts";

  return (
    <>
      <div className="mx-auto min-h-screen max-w-4xl bg-white pb-28 md:pb-10">
        <PushPromptBanner />

        {/* Greeting header */}
        <div className="px-5 pt-3 pb-0 md:px-8">
          <p className="text-xs font-medium text-gray-400">
            {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: tz }).format(new Date())}
          </p>
          <div className="flex items-end justify-between gap-2">
            <h1 className="mt-0.5 text-[1.7rem] font-display font-extrabold leading-tight tracking-tight text-gray-900">
              {dbUser.firstName ?? "Hey there"}
            </h1>
            <LivePill variant="row" />
          </div>
          {planWeekData && (
            <p className="text-xs text-gray-400 font-medium">
              Week {planWeekNum} of 8 · {planWeekData.theme}
            </p>
          )}
        </div>

        {/* Getting started checklist */}
        {gettingStarted.shouldShow && (
          <div className="px-5 md:px-8 mt-2">
            <GettingStartedCard
              tasks={gettingStarted.tasks}
              done={gettingStarted.done}
              total={gettingStarted.total}
              pct={gettingStarted.pct}
            />
          </div>
        )}

        {/* ── Stats + Check-in row ── */}
        <div className="mt-2 px-5 md:px-8 grid grid-cols-4 gap-2 max-w-sm">
          {[
            { label: "WORKOUTS", value: Number(workoutsThisWeek), sub: `/${weeklyWorkoutTarget}` },
            { label: "CHECK-INS", value: Number(checkinsThisWeek), sub: "/7" },
            { label: "STREAK", value: streak?.current ?? 0, sub: "days" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-2xl bg-gray-50 p-3 text-center">
              <p className="text-[8px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
              <p className="mt-0.5 text-2xl font-extrabold leading-none text-gray-900">{value}</p>
              <p className="text-[10px] text-gray-400">{sub}</p>
            </div>
          ))}
          <CheckInButton checkedInToday={checkedInToday} compact />
        </div>

        {/* ── Today: Workout + Recipe side by side ── */}
        <div className="mt-3 px-5 md:px-8">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[1.4rem] font-display font-extrabold tracking-tight text-gray-900">Today</h2>
            <Link href="/workouts" className="flex items-center gap-0.5 text-sm text-gray-400 hover:text-gray-600">
              All workouts <ChevronRight className="size-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* Workout card */}
            <Link href={workoutHref} className="group block">
              <div className="relative overflow-hidden rounded-2xl bg-gray-100 aspect-[4/5]">
                {todayWorkout?.thumbnailUrl ? (
                  <img
                    src={todayWorkout.thumbnailUrl}
                    alt={todayWorkout.title}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <PlayCircle className="size-10 text-gray-300" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                {todayWorkoutCompleted && (
                  <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-green-600">
                    ✓ Done
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/70">
                    {planWeekData ? `WEEK ${planWeekNum} · PLAN` : "WORKOUT"}
                  </p>
                  <p className="mt-0.5 text-sm font-bold leading-tight text-white line-clamp-2">
                    {todayWorkout?.title ?? "Your workout"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/70">
                    {todayWorkout?.durationMin ?? 25} min
                  </p>
                </div>
              </div>
            </Link>

            {/* Recipe card */}
            {todayRecipe ? (
              <Link href={`/recipes/${todayRecipe.slug}`} className="group block">
                <div className="relative overflow-hidden rounded-2xl bg-gray-100 aspect-[4/5]">
                  {todayRecipe.photoUrl ? (
                    <img
                      src={todayRecipe.photoUrl}
                      alt={todayRecipe.title}
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <Lightbulb className="size-10 text-gray-300" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/70">
                      {todayRecipe.mealType ?? "RECIPE"}
                    </p>
                    <p className="mt-0.5 text-sm font-bold leading-tight text-white line-clamp-2">
                      {todayRecipe.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/70">
                      {todayRecipe.calories ?? "—"} cal · {todayRecipe.timeMin ?? "—"} min
                    </p>
                  </div>
                  <div className="absolute right-2 top-2">
                    <SaveRecipeButton recipeId={todayRecipe.id} savedThisWeek={recipeSavedThisWeek} />
                  </div>
                </div>
              </Link>
            ) : (
              <Link href="/recipes" className="group block">
                <div className="flex aspect-[4/5] items-center justify-center rounded-2xl bg-gray-50">
                  <p className="text-xs text-gray-400">Browse recipes</p>
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* ── Community ── */}
        {recentPosts.length > 0 && (
          <div className="mt-5">
            <div className="mb-0 flex items-baseline justify-between px-5 md:px-8">
              <h2 className="text-xl font-display font-extrabold tracking-tight text-gray-900">Community</h2>
              <Link href="/community" className="flex items-center gap-0.5 text-sm text-gray-400 hover:text-gray-600">
                See all <ChevronRight className="size-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {recentPosts.map(({ post, author }) => (
                <Link
                  key={post.id}
                  href="/community"
                  className="flex items-center gap-3 px-5 md:px-8 py-3.5 transition-colors hover:bg-gray-50"
                >
                  {/* Avatar */}
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-extrabold text-primary">
                    {(author?.firstName ?? "M").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary leading-none">{post.category}</p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-gray-900">{post.body}</p>
                    <p className="text-xs text-gray-400">{author?.firstName ?? "Member"}</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-gray-300" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Active Challenge ── */}
        {activeChallenges[0] && (
          <div className="mt-5 px-5 md:px-8">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-xl font-display font-extrabold tracking-tight text-gray-900">Challenges</h2>
              <Link href="/challenges" className="flex items-center gap-0.5 text-sm text-gray-400 hover:text-gray-600">
                See all <ChevronRight className="size-3.5" />
              </Link>
            </div>
            <Link
              href={`/challenges/${activeChallenges[0].challenge.slug}`}
              className="group flex items-center gap-4 transition-opacity hover:opacity-80"
            >
              <div className="flex size-[72px] shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <Trophy className="size-8 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-primary">ACTIVE</p>
                <p className="mt-0.5 font-bold text-gray-900 leading-snug">{activeChallenges[0].challenge.title}</p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.round((activeChallenges[0].member.currentDay / activeChallenges[0].challenge.durationDays) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">Day {activeChallenges[0].member.currentDay} of {activeChallenges[0].challenge.durationDays}</p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-gray-300" />
            </Link>
          </div>
        )}

        {/* ── Plan tip ── */}
        {planWeekData?.tip && (
          <div className="mt-5 mx-5 md:mx-8 rounded-2xl bg-primary/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">This Week's Focus</p>
            <p className="mt-1 font-bold text-gray-900">{planWeekData.theme}</p>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">{planWeekData.tip}</p>
            <Link href="/plan" className="mt-3 flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              View my 8-week plan <ChevronRight className="size-3.5" />
            </Link>
          </div>
        )}

        {/* ── Streak + Buddy (stacked, no card borders) ── */}
        <div className="mt-5 space-y-4 px-5 md:px-8">
          <StreakCard
            current={streak?.current ?? 0}
            longest={streak?.longest ?? 0}
            freezeTokens={streak?.freezeTokens ?? 1}
            lastActionToday={lastActionToday}
          />

          <TierCard
            tier={dbUser.tier as Tier}
            workouts={tierStats.workouts}
            longestStreak={tierStats.longestStreak}
          />

          {/* Buddy */}
          <div className="rounded-2xl bg-gray-50 p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">Accountability Buddy</p>
            {buddy ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-extrabold text-primary">
                    {buddy.firstName?.slice(0, 1) ?? "?"}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{buddy.firstName} {buddy.lastName?.slice(0, 1)}.</p>
                    {buddyRow?.match.matchReason && (
                      <p className="text-xs text-gray-400">✨ {buddyRow.match.matchReason}</p>
                    )}
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="mt-4 w-full rounded-full border-gray-200">
                  <Link href="/community/buddy">Send a check-in</Link>
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-400 leading-relaxed">We're finding your perfect match.</p>
                <Button asChild variant="outline" size="sm" className="mt-3 w-full rounded-full border-gray-200">
                  <Link href="/community/buddy">View my buddy</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Pinned Start Workout button — Sweat style ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-white/95 px-5 pb-safe pt-3 backdrop-blur-sm md:hidden">
        <Button asChild variant="gradient" className="h-14 w-full rounded-full text-base font-bold shadow-lg">
          <Link href={workoutHref}>
            {todayWorkoutCompleted ? "Watch again" : "Start Workout"}
          </Link>
        </Button>
      </div>
    </>
  );
}
