"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkoutContext } from "@/lib/workout-context";
import { markWorkoutComplete } from "./actions";

type Trigger = "watched80" | "ended" | "tap";

/**
 * Shared "I finished this workout" logic for both video players.
 *
 * Saves the completion once. If the workout was opened from a challenge or
 * program day, the server ticks that day off and tells us where to go back
 * to. We return automatically when the video ends or the member taps the
 * button, but never yank them out mid-video when the 80% auto-save fires.
 */
export function useWorkoutCompletion(workoutId: string, ctx: WorkoutContext | null) {
  const router = useRouter();
  const reportedRef = useRef(false);
  const returnToRef = useRef<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    reportedRef.current = false;
    returnToRef.current = null;
    setCompleted(false);
    setError(null);
    setMessage(null);
    setReturnTo(null);
    setLeaving(false);
  }, [workoutId]);

  function goBack(href: string) {
    setLeaving(true);
    setTimeout(() => router.push(href), 1200);
  }

  async function report(trigger: Trigger) {
    if (reportedRef.current) {
      // Already saved at 80%; once the video actually ends, head back.
      if (trigger !== "watched80" && returnToRef.current) goBack(returnToRef.current);
      return;
    }
    reportedRef.current = true;
    setMarking(true);
    setError(null);
    try {
      const res = await markWorkoutComplete(workoutId, ctx);
      if ("ok" in res && res.ok) {
        setCompleted(true);
        setMessage(res.message);
        setReturnTo(res.returnTo);
        returnToRef.current = res.returnTo;
        if (res.returnTo && trigger !== "watched80") goBack(res.returnTo);
      } else {
        reportedRef.current = false;
        setError("Couldn't save. Tap to retry.");
      }
    } catch {
      reportedRef.current = false;
      setError("Couldn't save. Tap to retry.");
    } finally {
      setMarking(false);
    }
  }

  return { completed, marking, error, message, returnTo, leaving, report };
}

export function CompletionBar({
  state,
  backLabel,
}: {
  state: ReturnType<typeof useWorkoutCompletion>;
  backLabel: string | null;
}) {
  const { completed, marking, error, message, returnTo, leaving, report } = state;

  if (completed) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-800">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <Check className="size-4" />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">{message ?? "Workout logged"}</p>
          {leaving && returnTo && <p className="text-xs opacity-80">Taking you back…</p>}
        </div>
        {returnTo && (
          <Button asChild size="sm" variant="outline" className="shrink-0 border-emerald-300 bg-white">
            <Link href={returnTo}>
              <ChevronLeft className="size-4" /> {backLabel ? `Back to ${backLabel}` : "Back"}
            </Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button variant="gradient" size="sm" onClick={() => report("tap")} disabled={marking}>
        {marking ? (
          <>
            <Loader2 className="mr-1 size-4 animate-spin" /> Saving…
          </>
        ) : (
          <>
            <Check className="mr-1 size-4" /> I finished this workout
          </>
        )}
      </Button>
      <span className="text-xs text-muted-foreground">Saves on its own at 80% watched.</span>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
