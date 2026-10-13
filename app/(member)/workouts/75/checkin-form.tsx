"use client";

import { useState, useTransition } from "react";
import { saveCheckin } from "./actions";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const TASKS = [
  {
    key: "workout",
    label: "Complete a platform workout",
    sub: "Any 30-min workout from the community",
    href: "/workouts",
    cta: "Browse workouts →",
  },
  {
    key: "movement",
    label: "Log extra movement",
    sub: "A walk, stretch, hoop session — anything active",
    href: "/activity",
    cta: "Log it →",
  },
  {
    key: "recipe",
    label: "Make a community recipe",
    sub: "Cook one meal using a recipe from the platform",
    href: "/recipes",
    cta: "Browse recipes →",
  },
  {
    key: "water",
    label: "Drink 64 oz of water",
    sub: "Eight 8-oz glasses throughout the day",
    href: null,
    cta: null,
  },
  {
    key: "nutrition",
    label: "No junk food or takeout",
    sub: "Clean eating all day — no fast food, no alcohol",
    href: null,
    cta: null,
  },
];

export function CheckinForm({
  dayNumber,
  initialTasks,
  allDone,
}: {
  dayNumber: number;
  initialTasks: Record<string, boolean>;
  allDone: boolean;
}) {
  const [tasks, setTasks] = useState<Record<string, boolean>>(initialTasks);
  const [saved, setSaved] = useState(allDone);
  const [isPending, startTransition] = useTransition();

  function toggle(key: string) {
    setTasks((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }

  function handleSave() {
    startTransition(async () => {
      await saveCheckin(dayNumber, tasks);
      const isAllDone = TASKS.every((t) => tasks[t.key]);
      setSaved(isAllDone);
    });
  }

  const completedCount = TASKS.filter((t) => tasks[t.key]).length;
  const isAllDone = completedCount === TASKS.length;

  return (
    <div className="space-y-3">
      {isAllDone && (
        <div className="flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-950/30 px-4 py-3 text-green-700 dark:text-green-400">
          <CheckCircle2 className="size-5 shrink-0" />
          <p className="text-sm font-semibold">Day {dayNumber} complete! You're crushing it 🔥</p>
        </div>
      )}

      <div className="space-y-2">
        {TASKS.map((task) => {
          const done = !!tasks[task.key];
          return (
            <button
              key={task.key}
              type="button"
              onClick={() => toggle(task.key)}
              className={cn(
                "w-full flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
                done
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-background hover:border-primary/30"
              )}
            >
              <div className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                done ? "border-primary bg-primary" : "border-muted-foreground/40"
              )}>
                {done && <CheckCircle2 className="size-3.5 text-primary-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-semibold leading-snug", done && "line-through text-muted-foreground")}>
                  {task.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{task.sub}</p>
                {task.href && !done && (
                  <Link
                    href={task.href}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 inline-block text-xs font-semibold text-primary hover:underline"
                  >
                    {task.cta}
                  </Link>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-muted-foreground">{completedCount} of 5 tasks done today</p>
        <Button
          onClick={handleSave}
          disabled={isPending || completedCount === 0}
          size="sm"
          variant="gradient"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : saved ? "Saved ✓" : "Save check-in"}
        </Button>
      </div>
    </div>
  );
}
