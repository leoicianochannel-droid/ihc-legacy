"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Lock, Check, PlayCircle, Coffee } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { markProgramDayComplete } from "./actions";

type Workout = { slug: string; title: string } | null;

export function ProgramDayCard({
  day,
  exercises,
  locked,
  done,
  isToday,
  membershipId,
}: {
  day: {
    id: string;
    dayNumber: number;
    title: string;
    description: string | null;
    isRestDay: boolean;
  };
  exercises: Array<{ id: string; label: string; repsLabel: string | null; workout: Workout }>;
  locked: boolean;
  done: boolean;
  isToday: boolean;
  membershipId: string | null;
}) {
  // Open by default if it's "today's" day; otherwise collapsed.
  const [open, setOpen] = useState(isToday);

  const headerBg = done
    ? "bg-primary/5 border-primary/30"
    : isToday
    ? "border-primary/40 ring-2 ring-primary/20"
    : locked
    ? "opacity-70"
    : "";

  return (
    <div className={`overflow-hidden rounded-2xl border bg-card transition-all ${headerBg}`}>
      {/* Header — always visible, click to toggle */}
      <button
        type="button"
        onClick={() => !locked && setOpen((o) => !o)}
        disabled={locked}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <div className="flex items-center gap-3">
          {done ? (
            <div className="flex size-8 items-center justify-center rounded-full bg-primary text-white">
              <Check className="size-4" />
            </div>
          ) : locked ? (
            <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Lock className="size-4" />
            </div>
          ) : (
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
              {day.dayNumber}
            </div>
          )}
          <div>
            <div className="font-display text-lg font-bold leading-tight">
              Day {day.dayNumber}: {day.title}
            </div>
            {day.isRestDay && (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Coffee className="size-3" /> Rest day
              </div>
            )}
          </div>
        </div>
        {!locked &&
          (open ? (
            <ChevronUp className="size-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-5 text-muted-foreground" />
          ))}
      </button>

      {/* Body — exercises + actions */}
      {open && !locked && (
        <div className="border-t bg-background/50 px-4 py-3">
          {day.description && (
            <p className="mb-3 text-sm text-muted-foreground">{day.description}</p>
          )}

          {exercises.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exercises today — fully rest.</p>
          ) : (
            <ul className="space-y-1">
              {exercises.map((ex) => {
                const hasVideo = !!ex.workout;
                const content = (
                  <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/40">
                    <div className="flex items-center gap-3">
                      {hasVideo && <PlayCircle className="size-4 text-primary" />}
                      <span className="text-sm font-medium">
                        {ex.label}
                        {ex.repsLabel && (
                          <span className="text-muted-foreground"> ({ex.repsLabel})</span>
                        )}
                      </span>
                    </div>
                    {hasVideo && (
                      <span className="text-xs font-semibold text-primary">Watch</span>
                    )}
                  </div>
                );
                return (
                  <li key={ex.id}>
                    {hasVideo ? (
                      <Link href={`/workouts/${ex.workout!.slug}`} className="block">
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {!done && membershipId && (
            <form
              action={markProgramDayComplete.bind(null, membershipId, day.dayNumber)}
              className="mt-4"
            >
              <Button type="submit" variant="gradient" size="sm" className="w-full">
                Mark Day {day.dayNumber} complete
              </Button>
            </form>
          )}
          {done && (
            <p className="mt-4 text-center text-xs font-semibold text-primary">
              ✓ Day {day.dayNumber} complete
            </p>
          )}
        </div>
      )}

      {locked && (
        <div className="border-t bg-muted/20 px-4 py-3 text-center text-xs text-muted-foreground">
          Unlocks after Day {day.dayNumber - 1}
        </div>
      )}
    </div>
  );
}
