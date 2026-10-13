"use client";

import { useState, useTransition } from "react";
import { updateReminderTime } from "@/app/(member)/settings/actions";
import { Check } from "lucide-react";

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12;
  const ampm = i < 12 ? "AM" : "PM";
  const label = i === 0 ? "12:00 AM (midnight)" : i === 12 ? "12:00 PM (noon)" : `${h}:00 ${ampm}`;
  const value = `${String(i).padStart(2, "0")}:00`;
  return { value, label };
});

interface Props {
  initialTime?: string | null;
}

export function ReminderTimePicker({ initialTime }: Props) {
  const [selected, setSelected] = useState(initialTime ?? "");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setSelected(val);
    setSaved(false);
    startTransition(async () => {
      await updateReminderTime(val || null);
      if (val) setSaved(true);
    });
  }

  return (
    <div className="mt-4 space-y-1.5">
      <p className="text-sm font-semibold">Daily workout reminder</p>
      <p className="text-xs text-muted-foreground">
        We'll send you a nudge if you haven't checked in by this time each day.
      </p>
      <div className="flex items-center gap-2">
        <select
          value={selected}
          onChange={handleChange}
          disabled={isPending}
          className="rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        >
          <option value="">No reminder</option>
          {HOURS.map((h) => (
            <option key={h.value} value={h.value}>
              {h.label}
            </option>
          ))}
        </select>
        {saved && !isPending && (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <Check className="size-3.5" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}
