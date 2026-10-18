"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, Coffee, Loader2, Lock, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { workoutHref } from "@/lib/workout-context";
import { markProgramDayComplete } from "./actions";

type Exercise = {
  id: string;
  label: string;
  repsLabel: string | null;
  workout: { slug: string; title: string } | null;
  done: boolean;
};

export function ProgramDayCard({
  programSlug,
  day,
  exercises,
  locked,
  done,
  isToday,
  defaultOpen,
  membershipId,
}: {
  programSlug: string;
  day: { id: string; dayNumber: number; title: string; description: string | null; isRestDay: boolean };
  exercises: Exercise[];
  locked: boolean;
  done: boolean;
  isToday: boolean;
  defaultOpen: boolean;
  membershipId: string | null;
}) {
  const [open, setOpen] = useState(defaultOpen && !locked);
  const videos = exercises.filter((e) => e.workout);
  const videosDone = videos.filter((e) => e.done).length;
  const allVideo = exercises.length > 0 && videos.length === exercises.length;

  return (
    <div
      id={`day-${day.dayNumber}`}
      className={cn(
        "scroll-mt-20 overflow-hidden rounded-2xl border bg-card",
        isToday && !done && "border-primary/60",
      )}
    >
      <button
        type="button"
        onClick={() => !locked && setOpen((o) => !o)}
        disabled={locked}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left active:bg-muted/50 disabled:active:bg-transparent"
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            done
              ? "bg-emerald-100 text-emerald-700"
              : locked
                ? "bg-muted text-muted-foreground"
                : isToday
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary/10 text-primary",
          )}
        >
          {done ? <Check className="size-5" /> : locked ? <Lock className="size-4" /> : day.dayNumber}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cn("truncate font-semibold", locked && "text-muted-foreground")}>{day.title}</span>
            {isToday && !done && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                Today
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Day {day.dayNumber}
            {locked
              ? ` · Unlocks after Day ${day.dayNumber - 1}`
              : day.isRestDay
                ? " · Rest day"
                : videos.length > 0
                  ? ` · ${videosDone} of ${videos.length} videos done`
                  : exercises.length > 0
                    ? ` · ${exercises.length} exercises`
                    : ""}
          </span>
        </span>

        {!locked && (
          <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        )}
      </button>

      {open && !locked && (
        <div className="border-t px-4 pb-4 pt-3">
          {day.description && <p className="mb-3 text-sm text-muted-foreground">{day.description}</p>}

          {exercises.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Coffee className="size-4" /> Rest today. Your body needs it.
            </p>
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border">
              {exercises.map((ex) => {
                const row = (
                  <>
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full",
                        ex.done ? "bg-emerald-600 text-white" : ex.workout ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {ex.done ? <Check className="size-4" /> : ex.workout ? <PlayCircle className="size-4" /> : <span className="size-1.5 rounded-full bg-current" />}
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium">{ex.label}</span>
                      {ex.repsLabel && <span className="block text-xs text-muted-foreground">{ex.repsLabel}</span>}
                    </span>
                    {ex.workout && (
                      <span className="flex shrink-0 items-center text-xs font-semibold text-primary">
                        {ex.done ? "Again" : "Watch"} <ChevronRight className="size-4" />
                      </span>
                    )}
                  </>
                );
                return (
                  <li key={ex.id}>
                    {ex.workout ? (
                      <Link
                        href={workoutHref(ex.workout.slug, { kind: "program", slug: programSlug, day: day.dayNumber })}
                        className="flex min-h-[52px] items-center gap-3 px-3 py-2 active:bg-muted/50"
                      >
                        {row}
                      </Link>
                    ) : (
                      <div className="flex min-h-[52px] items-center gap-3 px-3 py-2">{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-4">
            {done ? (
              <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-700">
                <Check className="size-4" /> Day {day.dayNumber} complete
              </p>
            ) : membershipId ? (
              <form action={markProgramDayComplete.bind(null, membershipId, day.dayNumber)}>
                {allVideo && (
                  <p className="mb-2 text-center text-xs text-muted-foreground">
                    Finish each video and this day checks itself off.
                  </p>
                )}
                <SubmitButton subtle={allVideo}>
                  {day.isRestDay || exercises.length === 0 ? "Mark rest day done" : `Mark Day ${day.dayNumber} complete`}
                </SubmitButton>
              </form>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function SubmitButton({ children, subtle }: { children: React.ReactNode; subtle: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={subtle ? "outline" : "gradient"} className="w-full" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : children}
    </Button>
  );
}
