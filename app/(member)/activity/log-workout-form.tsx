"use client";

import { useState, useTransition } from "react";
import { logPersonalWorkout } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTIVITY_TYPES = [
  { value: "hooping", label: "🪀 Hooping" },
  { value: "restyling", label: "✨ Restyling" },
  { value: "walking", label: "🚶 Walking" },
  { value: "dance", label: "💃 Dance" },
  { value: "yoga", label: "🧘 Yoga / Stretch" },
  { value: "gym", label: "🏋️ Gym" },
  { value: "other", label: "⚡ Other" },
];

const QUICK_DURATIONS = [15, 20, 30, 45, 60, 90];

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function LogWorkoutForm() {
  const [activityType, setActivityType] = useState("");
  const [duration, setDuration] = useState(30);
  const [customDuration, setCustomDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [loggedDate, setLoggedDate] = useState(todayStr);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  const effectiveDuration = customDuration ? parseInt(customDuration, 10) : duration;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("activityType", activityType);
    fd.set("durationMin", String(effectiveDuration));
    fd.set("notes", notes);
    fd.set("loggedDate", loggedDate);
    startTransition(async () => {
      const res = await logPersonalWorkout(null, fd);
      setResult(res ?? null);
      if (res?.ok) {
        setActivityType("");
        setNotes("");
        setCustomDuration("");
        setDuration(30);
        setLoggedDate(todayStr());
        setTimeout(() => setResult(null), 3000);
      }
    });
  }

  if (result?.ok) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <CheckCircle2 className="size-10 text-green-500" />
        <p className="font-semibold text-lg">Workout logged!</p>
        <p className="text-sm text-muted-foreground">Your streak is counting this. Keep it up! 🔥</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Activity type */}
      <div>
        <p className="mb-2 text-sm font-semibold">What did you do?</p>
        <div className="flex flex-wrap gap-2">
          {ACTIVITY_TYPES.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setActivityType(a.value)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                activityType === a.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:border-primary/50"
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <p className="mb-2 text-sm font-semibold">How long?</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => { setDuration(d); setCustomDuration(""); }}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                duration === d && !customDuration
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:border-primary/50"
              )}
            >
              {d} min
            </button>
          ))}
          <div className="relative">
            <input
              type="number"
              min={1}
              max={480}
              placeholder="Custom"
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
              className={cn(
                "w-24 rounded-full border px-3.5 py-1.5 text-sm font-medium bg-background text-center focus:outline-none focus:ring-2 focus:ring-primary/50",
                customDuration ? "border-primary" : "border-border"
              )}
            />
          </div>
        </div>
      </div>

      {/* Date */}
      <div>
        <p className="mb-2 text-sm font-semibold">When?</p>
        <input
          type="date"
          value={loggedDate}
          max={todayStr()}
          onChange={(e) => setLoggedDate(e.target.value)}
          className="rounded-xl border bg-background px-3.5 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {loggedDate !== todayStr() && (
          <span className="ml-2 text-xs text-muted-foreground">Logging for a past day</span>
        )}
      </div>

      {/* Notes */}
      <div>
        <p className="mb-2 text-sm font-semibold">Notes <span className="font-normal text-muted-foreground">(optional)</span></p>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What did you work on? How did it feel?"
          rows={2}
          className="resize-none"
        />
      </div>

      {result?.error && (
        <p className="text-sm text-destructive">{result.error}</p>
      )}

      <Button
        type="submit"
        variant="gradient"
        disabled={isPending || !activityType || effectiveDuration < 1}
        className="w-full"
      >
        {isPending ? (
          <><Loader2 className="mr-2 size-4 animate-spin" /> Logging…</>
        ) : (
          "Log it 🔥"
        )}
      </Button>
    </form>
  );
}
