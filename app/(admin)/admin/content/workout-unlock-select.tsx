"use client";

import { useTransition } from "react";
import { setWorkoutUnlockDay } from "./actions";

export function WorkoutUnlockSelect({
  workoutId,
  current,
}: {
  workoutId: string;
  current: number | null;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => setWorkoutUnlockDay(workoutId, fd));
      }}
      className="flex items-center gap-1"
    >
      <select
        name="day"
        defaultValue={current ?? ""}
        disabled={isPending}
        onChange={(e) => {
          const fd = new FormData();
          fd.set("day", e.target.value);
          startTransition(() => setWorkoutUnlockDay(workoutId, fd));
        }}
        className="h-7 rounded-lg border bg-background px-2 text-xs font-semibold disabled:opacity-50"
      >
        <option value="">Auto (by intensity)</option>
        <option value="0">Always free</option>
        <option value="30">Day 30</option>
        <option value="60">Day 60</option>
        <option value="90">Day 90</option>
      </select>
    </form>
  );
}
