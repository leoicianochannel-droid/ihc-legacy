"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PlayCircle, Salad, Trophy, ChevronDown, ChevronUp,
  CheckCircle2, Lightbulb, RefreshCw, Loader2, X,
} from "lucide-react";
import type { PlanWeek, PlanWorkoutRef } from "@/lib/plan-types";

const DAY_PATTERNS: Record<number, string[]> = {
  2: ["Monday", "Thursday"],
  3: ["Monday", "Wednesday", "Friday"],
  4: ["Monday", "Tuesday", "Thursday", "Friday"],
  5: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  6: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  7: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
};

function getWorkoutDayLabel(workoutIndex: number, totalWorkouts: number, daysPerWeek: number | null): string | null {
  const count = daysPerWeek ?? totalWorkouts;
  const pattern = DAY_PATTERNS[count] ?? DAY_PATTERNS[totalWorkouts];
  if (!pattern) return null;
  return pattern[workoutIndex] ?? `Day ${workoutIndex + 1}`;
}

type SwapState = {
  workoutIndex: number;
  status: "loading" | "ready";
  alternatives: PlanWorkoutRef[];
  hoopIds: Set<string>;
};

export function PlanWeekCard({
  week: initialWeek,
  weekIndex,
  isCurrent,
  isCompleted,
  daysPerWeek = null,
}: {
  week: PlanWeek;
  weekIndex: number;
  isCurrent: boolean;
  isCompleted: boolean;
  daysPerWeek?: number | null;
}) {
  const [open, setOpen] = useState(isCurrent);
  const [week, setWeek] = useState(initialWeek);
  const [swapState, setSwapState] = useState<SwapState | null>(null);

  async function handleSwapStart(workoutIndex: number, currentWorkoutId: string) {
    setSwapState({ workoutIndex, status: "loading", alternatives: [], hoopIds: new Set() });
    try {
      const res = await fetch(
        `/api/member/swap-workout?weekIndex=${weekIndex}&currentWorkoutId=${encodeURIComponent(currentWorkoutId)}`
      );
      const data = await res.json();
      setSwapState({
        workoutIndex,
        status: "ready",
        alternatives: data.alternatives ?? [],
        hoopIds: new Set(data.hoopIds ?? []),
      });
    } catch {
      setSwapState(null);
    }
  }

  async function handleSwapConfirm(newWorkout: PlanWorkoutRef) {
    if (!swapState) return;
    const { workoutIndex } = swapState;

    // Optimistic update
    setWeek((prev) => {
      const updatedWorkouts = [...prev.workouts];
      updatedWorkouts[workoutIndex] = newWorkout;
      return { ...prev, workouts: updatedWorkouts };
    });
    setSwapState(null);

    // Persist
    await fetch("/api/member/swap-workout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekIndex, workoutIndex, newWorkout }),
    });
  }

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all",
        isCurrent && "border-primary ring-2 ring-primary/20",
        isCompleted && "opacity-70"
      )}
    >
      {/* Header row */}
      <button
        className="flex w-full items-center gap-4 p-4 text-left md:p-6"
        onClick={() => setOpen((o) => !o)}
      >
        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            isCompleted
              ? "bg-emerald-100 text-emerald-700"
              : isCurrent
              ? "bg-primary text-white"
              : "bg-muted text-muted-foreground"
          )}
        >
          {isCompleted ? (
            <CheckCircle2 className="size-6" />
          ) : (
            <span>W{week.week}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-lg font-bold leading-tight">{week.theme}</span>
            {isCurrent && (
              <Badge className="text-[10px] uppercase tracking-wider">Current week</Badge>
            )}
            {isCompleted && (
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200">
                Complete ✓
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">{week.description}</p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <PlayCircle className="size-3" />
              {week.workouts.length > 0 && daysPerWeek && DAY_PATTERNS[daysPerWeek] ? (
                <span>
                  {DAY_PATTERNS[daysPerWeek].slice(0, week.workouts.length).map(d => d.slice(0, 3)).join(" · ")}
                </span>
              ) : (
                <span>{week.workouts.length} workout{week.workouts.length !== 1 ? "s" : ""}</span>
              )}
            </span>
            {week.recipes.length > 0 && (
              <span className="flex items-center gap-1">
                <Salad className="size-3" /> {week.recipes.length} recipe{week.recipes.length !== 1 ? "s" : ""}
              </span>
            )}
            {week.challengeSlug && (
              <span className="flex items-center gap-1 text-primary">
                <Trophy className="size-3" /> Challenge active
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-muted-foreground">
          {open ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <CardContent className="border-t p-4 md:p-6 pt-4">

          <p className="text-sm text-foreground/80 leading-relaxed">{week.description}</p>

          {week.tip && (
            <div className="mt-4 flex items-start gap-3 rounded-xl bg-primary/5 p-4">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-sm text-foreground/80">
                <strong className="text-foreground">Tip:</strong> {week.tip}
              </p>
            </div>
          )}

          {/* Workouts */}
          {week.workouts.length > 0 && (
            <div className="mt-6">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <PlayCircle className="size-3.5" /> This week's workouts
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {week.workouts.map((w, i) => {
                  const dayLabel = getWorkoutDayLabel(i, week.workouts.length, daysPerWeek);
                  const isSwapping = swapState?.workoutIndex === i;
                  return (
                    <div key={`${w.workoutId}-${i}`} className="relative group/swap">
                      <Link
                        href={`/workouts/${w.slug}`}
                        className="group flex items-center gap-3 rounded-xl border bg-card p-3 transition-all hover:border-primary/40 hover:shadow-sm"
                      >
                        <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {w.thumbnailUrl ? (
                            <img src={w.thumbnailUrl} alt={w.title} className="size-full object-cover" />
                          ) : (
                            <div className="flex size-full items-center justify-center">
                              <PlayCircle className="size-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pr-6">
                          {dayLabel && (
                            <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-0.5">
                              {dayLabel}
                            </p>
                          )}
                          <p className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                            {w.title}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Badge variant="secondary" className="text-[10px] capitalize">{w.intensity}</Badge>
                            {w.durationMin && <span>{w.durationMin} min</span>}
                          </div>
                        </div>
                      </Link>

                      {/* Swap button — shown on hover, outside the Link */}
                      <button
                        type="button"
                        onClick={() => isSwapping ? setSwapState(null) : handleSwapStart(i, w.workoutId)}
                        className={cn(
                          "absolute right-2 top-2 rounded-full p-1.5 border bg-background transition-all",
                          isSwapping
                            ? "opacity-100 border-primary/40 text-primary"
                            : "opacity-0 group-hover/swap:opacity-100 text-muted-foreground hover:text-primary hover:border-primary/40"
                        )}
                        title={isSwapping ? "Cancel swap" : "Swap this workout"}
                      >
                        {isSwapping && swapState?.status === "loading" ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : isSwapping ? (
                          <X className="size-3.5" />
                        ) : (
                          <RefreshCw className="size-3.5" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Swap alternatives panel */}
              {swapState && swapState.status === "ready" && swapState.alternatives.length > 0 && (
                <div className="mt-3 rounded-xl border bg-muted/30 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Choose a replacement
                    </p>
                    <button
                      onClick={() => setSwapState(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {swapState.alternatives.map((alt) => (
                      <button
                        key={alt.workoutId}
                        type="button"
                        onClick={() => handleSwapConfirm(alt)}
                        className="flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:border-primary/40 hover:shadow-sm"
                      >
                        <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {alt.thumbnailUrl ? (
                            <img src={alt.thumbnailUrl} alt={alt.title} className="size-full object-cover" />
                          ) : (
                            <div className="flex size-full items-center justify-center">
                              <PlayCircle className="size-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm leading-tight line-clamp-2">{alt.title}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <Badge variant="secondary" className="text-[10px] capitalize">{alt.intensity}</Badge>
                            {alt.durationMin && <span>{alt.durationMin} min</span>}
                            {swapState.hoopIds.has(alt.workoutId) && (
                              <Badge className="text-[10px] bg-primary/10 text-primary hover:bg-primary/10 border-none">
                                Hoop
                              </Badge>
                        )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recipes */}
          {week.recipes.length > 0 && (
            <div className="mt-6">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Salad className="size-3.5" /> This week's recipes
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {week.recipes.map((r, i) => (
                  <Link
                    key={`${r.recipeId}-${i}`}
                    href={`/recipes/${r.slug}`}
                    className="group flex items-center gap-3 rounded-xl border bg-card p-3 transition-all hover:border-primary/40 hover:shadow-sm"
                  >
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {r.photoUrl ? (
                        <img src={r.photoUrl} alt={r.title} className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <Salad className="size-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                        {r.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground capitalize">{r.mealType}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Challenge */}
          {week.challengeSlug && (
            <div className="mt-6">
              <div className="flex items-center justify-between rounded-xl bg-amber-50 p-4 dark:bg-amber-950/20">
                <div className="flex items-center gap-3">
                  <Trophy className="size-5 text-amber-600" />
                  <div>
                    <p className="font-semibold text-sm">Challenge active this week</p>
                    <p className="text-xs text-muted-foreground">Keep your streak going alongside your plan</p>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/challenges/${week.challengeSlug}`}>View</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
