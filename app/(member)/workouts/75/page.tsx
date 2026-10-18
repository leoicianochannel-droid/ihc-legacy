import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Flame, Trophy, Droplets, Utensils, Dumbbell, Footprints, Shield, Users, Gift } from "lucide-react";
import { getIH75Data, enrollInIH75 } from "./actions";
import { CheckinForm } from "./checkin-form";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getHighestEarnedReward, getNextReward, CHALLENGE_REWARDS } from "@/lib/challenge-rewards";

export const dynamic = "force-dynamic";

const RULES = [
  { icon: Dumbbell, label: "Platform workout", desc: "Complete one 30-min community workout every day" },
  { icon: Footprints, label: "Extra movement", desc: "Log a walk, stretch, or extra hoop session" },
  { icon: Utensils, label: "Community recipe", desc: "Cook one meal from the platform's recipe library" },
  { icon: Droplets, label: "64 oz of water", desc: "Stay hydrated — 8 glasses throughout the day" },
  { icon: Shield, label: "Clean eating", desc: "No junk food, fast food, or alcohol all day" },
];

export default async function IH75Page() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const data = await getIH75Data();

  if (!data.enrollment) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-8 pt-2 md:px-10">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Flame className="size-9 text-primary" />
          </div>
          <h1 className="font-display text-4xl font-bold">IH 75</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            75 days. 5 daily tasks. Your strongest self yet.
          </p>
        </div>

        {/* What it is */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <p className="font-display text-lg font-bold">What is IH 75?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              IH 75 is our community's version of 75 Hard — designed for real life. Every day for 75 days,
              you complete 5 simple tasks using the tools already inside this community. Miss a day? Just
              pick back up — we believe in progress over perfection.
            </p>
          </CardContent>
        </Card>

        {/* Rules */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <p className="mb-4 font-display font-bold">Your 5 daily tasks</p>
            <div className="space-y-4">
              {RULES.map(({ icon: Icon, label, desc }, i) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-bold text-primary">
                    {i + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-primary" />
                      <p className="text-sm font-semibold">{label}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Start button */}
        <form action={enrollInIH75}>
          <Button type="submit" variant="gradient" size="lg" className="w-full">
            <Flame className="mr-2 size-5" /> Start IH 75 Today
          </Button>
        </form>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Your 75-day clock starts today. Check in daily to track your progress.
        </p>
      </div>
    );
  }

  const { currentDay, checkins, todayCheckin } = data;
  const completedDays = checkins.filter((c) => c.allDone).length;
  const progressPct = Math.round((completedDays / 75) * 100);
  const isFinished = currentDay > 75;

  const earnedReward = getHighestEarnedReward("75-hard", completedDays);
  const nextReward = getNextReward("75-hard", completedDays);
  const allTiers = CHALLENGE_REWARDS["75-hard"] ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-2 md:px-10 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Flame className="size-7 text-primary" />
            <h1 className="font-display text-3xl font-bold">IH 75</h1>
            {isFinished && (
              <span className="rounded-full bg-yellow-100 px-3 py-0.5 text-xs font-bold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                🏆 Completed!
              </span>
            )}
          </div>
          <Link
            href="/workouts/75/leaderboard"
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
          >
            <Users className="size-3.5" /> Leaderboard
          </Link>
        </div>
        <p className="mt-1 text-muted-foreground">
          {isFinished ? "You completed the full 75 days — incredible!" : `Day ${currentDay} of 75`}
        </p>
      </div>

      {/* Progress bar */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">{completedDays} days completed</p>
            <p className="text-sm font-semibold text-primary">{progressPct}%</p>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span><strong className="text-foreground">{75 - currentDay + 1}</strong> days remaining</span>
            <span><strong className="text-foreground">{75 - completedDays}</strong> check-ins left</span>
          </div>
        </CardContent>
      </Card>

      {/* Reward Ladder */}
      {allTiers.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="size-4 text-primary" />
              <p className="font-display font-bold">Prize Rewards</p>
            </div>
            <div className="space-y-2">
              {allTiers.map((tier) => {
                const isEarned = completedDays >= tier.minCompleted;
                const isNext = nextReward?.minCompleted === tier.minCompleted;
                const remaining = tier.minCompleted - completedDays;
                return (
                  <div
                    key={tier.minCompleted}
                    className={cn(
                      "flex items-center justify-between rounded-xl px-4 py-3 text-sm",
                      isEarned
                        ? "bg-green-50 dark:bg-green-950/30"
                        : isNext
                        ? "bg-primary/5 border border-primary/20"
                        : "bg-muted/40"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span>{tier.emoji}</span>
                      <div>
                        <span className={cn("font-semibold", isEarned ? "text-green-700 dark:text-green-400" : isNext ? "text-primary" : "text-muted-foreground")}>
                          {tier.label}
                        </span>
                        <p className={cn("text-xs mt-0.5", isEarned ? "text-green-600 dark:text-green-500" : "text-muted-foreground")}>
                          {tier.items.join(" + ")}
                        </p>
                      </div>
                    </div>
                    {isEarned ? (
                      <span className="text-xs font-bold text-green-600 dark:text-green-400">Earned ✓</span>
                    ) : isNext ? (
                      <span className="text-xs font-semibold text-primary">{remaining} to go</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Locked</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Earned Reward Banner */}
      {earnedReward && (
        <div className="rounded-2xl border-2 border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-950/30">
          <div className="flex items-start gap-3">
            <span className="text-2xl">{earnedReward.emoji}</span>
            <div className="flex-1">
              <p className="font-display font-bold text-yellow-800 dark:text-yellow-300">
                You've earned: {earnedReward.label}!
              </p>
              <p className="mt-0.5 text-sm text-yellow-700 dark:text-yellow-400">
                {earnedReward.items.join(" + ")} — our team will be in touch to ship your reward.
              </p>
              {nextReward && (
                <p className="mt-2 text-xs font-semibold text-yellow-600 dark:text-yellow-500">
                  Keep going — {nextReward.remaining} more days unlocks {nextReward.label}!
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Today's check-in */}
      {!isFinished && (
        <Card className="border-primary/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-display font-bold">Day {currentDay} check-in</p>
              {todayCheckin?.allDone && (
                <span className="flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
                  <Trophy className="size-3.5" /> Done
                </span>
              )}
            </div>
            <CheckinForm
              dayNumber={currentDay}
              initialTasks={todayCheckin?.tasks ?? {}}
              allDone={todayCheckin?.allDone ?? false}
            />
          </CardContent>
        </Card>
      )}

      {/* 75-day grid */}
      <Card>
        <CardContent className="p-5">
          <p className="mb-3 font-display font-bold">Your 75 days</p>
          <div className="grid grid-cols-[repeat(15,1fr)] gap-1">
            {Array.from({ length: 75 }, (_, i) => {
              const day = i + 1;
              const checkin = checkins.find((c) => c.dayNumber === day);
              const isPast = day < currentDay;
              const isToday = day === currentDay;
              const isDone = checkin?.allDone;
              const isPartial = checkin && !checkin.allDone;
              const isFuture = day > currentDay;

              return (
                <div
                  key={day}
                  title={`Day ${day}`}
                  className={cn(
                    "aspect-square rounded-sm text-[9px] font-bold flex items-center justify-center transition-colors",
                    isDone && "bg-primary text-primary-foreground",
                    isPartial && "bg-primary/30 text-primary",
                    isToday && !isDone && !isPartial && "ring-2 ring-primary bg-primary/10 text-primary",
                    isPast && !isDone && !isPartial && "bg-muted text-muted-foreground",
                    isFuture && "bg-muted/40 text-muted-foreground/40"
                  )}
                >
                  {day}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block size-3 rounded-sm bg-primary" /> Complete</span>
            <span className="flex items-center gap-1"><span className="inline-block size-3 rounded-sm bg-primary/30" /> Partial</span>
            <span className="flex items-center gap-1"><span className="inline-block size-3 rounded-sm bg-muted" /> Missed</span>
          </div>
        </CardContent>
      </Card>

      {/* Daily rules reminder */}
      <Card>
        <CardContent className="p-5">
          <p className="mb-3 text-sm font-semibold">Daily task reminder</p>
          <div className="space-y-2">
            {RULES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="size-4 shrink-0 text-primary" />
                {label}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
