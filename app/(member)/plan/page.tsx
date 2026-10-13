import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db, users, memberPlans, planQuestionnaires } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { GeneratedPlan, PlanWeek } from "@/lib/plan-types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PlayCircle, Salad, Trophy, ArrowRight, Sparkles,
  CheckCircle2, ChevronDown, ChevronUp, Calendar, Lightbulb,
} from "lucide-react";
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
        .select({ daysPerWeek: planQuestionnaires.daysPerWeek })
        .from(planQuestionnaires)
        .where(eq(planQuestionnaires.id, planRow.questionnaireId))
        .limit(1)
    : [];
  const daysPerWeek = questionnaire?.daysPerWeek ?? null;

  const msSinceStart = Date.now() - new Date(startedAt).getTime();
  const daysSinceStart = Math.floor(msSinceStart / (1000 * 60 * 60 * 24));
  // Allow currentWeek to reach 9 so week 8 flips to isCompleted (week.week < 9 = true)
  const currentWeek = Math.min(9, Math.max(1, Math.floor(daysSinceStart / 7) + 1));
  const overallProgress = Math.round((daysSinceStart / 56) * 100);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-10 md:py-10">

      {/* ── Hero ──────────────────────────────────────────────── */}
      {isNew && (
        <div className="mb-8 rounded-3xl bg-primary px-8 py-10 text-white text-center">
          <Sparkles className="mx-auto mb-3 size-10 opacity-80" />
          <h1 className="font-display text-2xl font-bold md:text-4xl">
            Your plan is ready, {me.firstName ?? "friend"}! 🎉
          </h1>
          <p className="mt-3 text-white/80 max-w-md mx-auto">
            {plan.summary}
          </p>
          <Button asChild variant="outline" className="mt-6 border-white/30 text-white hover:bg-white/10">
            <Link href="/dashboard">Go to my dashboard <ArrowRight className="size-4" /></Link>
          </Button>
        </div>
      )}

      {!isNew && (
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold md:text-4xl">{plan.title}</h1>
          <p className="mt-2 text-muted-foreground">{plan.summary}</p>
        </div>
      )}

      {/* ── Progress bar ─────────────────────────────────────── */}
      <Card className="mb-8 p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your progress</div>
            <div className="mt-1 font-display text-2xl font-bold">
              Week {Math.min(currentWeek, 8)} <span className="text-muted-foreground font-sans text-base font-normal">of 8</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-3xl font-bold text-primary">{Math.min(overallProgress, 100)}%</div>
            <div className="text-xs text-muted-foreground">complete</div>
          </div>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-1000"
            style={{ width: `${Math.min(overallProgress, 100)}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>Day 1</span>
          <span>Day 56</span>
        </div>
      </Card>

      {/* ── Week cards ───────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Your weeks</h2>
        <RefreshPlanButton />
      </div>
      <div className="space-y-4">
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

      {/* ── Footer CTA ───────────────────────────────────────── */}
      <div className="mt-10 rounded-2xl border bg-muted/40 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Your plan runs for <strong>8 weeks</strong> from {new Date(startedAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}. Stay consistent and you'll feel the difference.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Button asChild variant="default">
            <Link href="/workouts">Browse all workouts</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
