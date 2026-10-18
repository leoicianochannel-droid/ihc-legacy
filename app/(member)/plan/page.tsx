import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db, users, memberPlans, planQuestionnaires } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { GeneratedPlan } from "@/lib/plan-types";
import { noDashes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowRight, PartyPopper, Sparkles } from "lucide-react";
import { PlanWeekCard } from "@/components/member/plan-week-card";
import { RefreshPlanButton } from "@/components/member/refresh-plan-button";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const sp = await searchParams;
  const isNew = sp.new === "1";

  const [me] = await db
    .select({ id: users.id, firstName: users.firstName, planCompletedAt: users.planCompletedAt })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!me || !me.planCompletedAt) redirect("/plan-setup");

  const [planRow] = await db
    .select()
    .from(memberPlans)
    .where(eq(memberPlans.userId, me.id))
    .limit(1);

  if (!planRow) redirect("/plan-setup");

  const plan = planRow.plan as GeneratedPlan;
  // Use createdAt (never reset) rather than startedAt (reset on every regeneration)
  const startedAt = planRow.createdAt ?? planRow.startedAt;

  // Fetch daysPerWeek from the linked questionnaire (for workout day labels)
  const [questionnaire] = planRow.questionnaireId
    ? await db
        .select({ daysPerWeek: planQuestionnaires.daysPerWeek, goal: planQuestionnaires.goal })
        .from(planQuestionnaires)
        .where(eq(planQuestionnaires.id, planRow.questionnaireId))
        .limit(1)
    : [];
  const daysPerWeek = questionnaire?.daysPerWeek ?? null;

  const msSinceStart = Date.now() - new Date(startedAt).getTime();
  const daysSinceStart = Math.max(0, Math.floor(msSinceStart / (1000 * 60 * 60 * 24)));
  // Allow currentWeek to reach 9 so week 8 flips to isCompleted (week.week < 9 = true)
  const currentWeek = Math.min(9, Math.max(1, Math.floor(daysSinceStart / 7) + 1));
  const finished = currentWeek > 8;
  const dayNumber = Math.min(56, daysSinceStart + 1);
  const progressPct = finished ? 100 : Math.round((dayNumber / 56) * 100);

  // One clean line built from their answers, instead of the stored blurb.
  const GOAL_TEXT: Record<string, string> = {
    weight_loss: "weight loss",
    toning: "toning and strength",
    cardio: "cardio",
    stress_relief: "stress relief",
  };
  const summary =
    daysPerWeek && questionnaire?.goal
      ? `${daysPerWeek} workouts a week, built for ${GOAL_TEXT[questionnaire.goal] ?? "your goal"}. Go at your own pace.`
      : noDashes(plan.summary);
  const startedLabel = new Date(startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-10 md:py-8">
      {isNew ? (
        <div className="mb-6 rounded-2xl bg-primary px-5 py-6 text-primary-foreground">
          <Sparkles className="size-6 opacity-80" />
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight">
            Your plan is ready{me.firstName ? `, ${me.firstName}` : ""}!
          </h1>
          <p className="mt-1 text-sm opacity-90">{summary}</p>
          <Button asChild variant="secondary" className="mt-4">
            <Link href="/dashboard">Start today <ArrowRight className="size-4" /></Link>
          </Button>
        </div>
      ) : (
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">My plan</p>
          <h1 className="mt-1 font-display text-2xl font-bold leading-tight md:text-3xl">{noDashes(plan.title)}</h1>
          <p className="mt-1 text-muted-foreground">{summary}</p>
        </div>
      )}

      {/* Progress */}
      <div className="mb-6 rounded-2xl border bg-card p-4">
        {finished ? (
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <PartyPopper className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">You finished all 8 weeks</p>
              <p className="text-sm text-muted-foreground">Keep the habit going with any workout.</p>
            </div>
            <Button asChild size="sm" className="shrink-0">
              <Link href="/workouts">Workouts</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <p className="font-semibold">
                Week {currentWeek} <span className="font-normal text-muted-foreground">of 8</span>
              </p>
              <p className="text-sm text-muted-foreground">Day {dayNumber} of 56</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Started {startedLabel}</p>
          </>
        )}
      </div>

      {/* Weeks */}
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your 8 weeks</h2>
        <RefreshPlanButton />
      </div>
      <div className="space-y-2">
        {plan.weeks.map((week, i) => (
          <PlanWeekCard
            key={week.week}
            week={week}
            weekIndex={i}
            isCurrent={week.week === currentWeek && currentWeek <= 8}
            isCompleted={week.week < currentWeek}
            daysPerWeek={daysPerWeek}
          />
        ))}
      </div>
    </div>
  );
}
