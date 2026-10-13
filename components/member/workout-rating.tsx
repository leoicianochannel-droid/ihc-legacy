"use client";

import { useState, useTransition } from "react";
import { Star, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { rateWorkout } from "@/app/(member)/workouts/[slug]/actions";

const TRUSTPILOT_URL = "https://www.trustpilot.com/review/infinityhoop.com";

const LABELS: Record<number, string> = {
  1: "Not for me",
  2: "Needs work",
  3: "Pretty good",
  4: "Loved it!",
  5: "Amazing! 🔥",
};

export function WorkoutRating({
  workoutId,
  initialRating,
}: {
  workoutId: string;
  initialRating: number | null;
}) {
  const [selected, setSelected] = useState<number | null>(initialRating);
  const [hovered, setHovered] = useState<number | null>(null);
  const [saved, setSaved] = useState(!!initialRating);
  const [showTrustpilot, setShowTrustpilot] = useState(false);
  const [isPending, startTransition] = useTransition();

  const display = hovered ?? selected;

  function handleRate(rating: number) {
    setSelected(rating);
    startTransition(async () => {
      await rateWorkout(workoutId, rating);
      setSaved(true);
      if (rating >= 4) setShowTrustpilot(true);
    });
  }

  return (
    <div className="mt-6 rounded-2xl border bg-muted/30 p-4">
      <p className="text-sm font-semibold text-foreground/80">
        {saved ? "Thanks for rating this workout!" : "How was this workout?"}
      </p>

      {/* Stars */}
      <div
        className="mt-2 flex items-center gap-1"
        onMouseLeave={() => setHovered(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHovered(star)}
            disabled={isPending}
            aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
            className="group transition-transform hover:scale-110 disabled:opacity-50"
          >
            <Star
              className={cn(
                "size-8 transition-colors",
                display && star <= display
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-muted-foreground"
              )}
            />
          </button>
        ))}
        {isPending && <Loader2 className="ml-2 size-4 animate-spin text-muted-foreground" />}
        {display && (
          <span className="ml-2 text-sm font-semibold text-foreground/70">
            {LABELS[display]}
          </span>
        )}
      </div>

      {/* Trustpilot nudge for 4–5 stars */}
      {showTrustpilot && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/40">
          <div className="text-2xl">🌟</div>
          <div className="flex-1">
            <p className="text-sm font-bold">You're loving it — would you share that?</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              A quick review on Trustpilot helps other women find Infinity Hoop. Takes 60 seconds.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href={TRUSTPILOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
              >
                Leave a review <ExternalLink className="size-3" />
              </a>
              <button
                type="button"
                onClick={() => setShowTrustpilot(false)}
                className="rounded-full border px-4 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
