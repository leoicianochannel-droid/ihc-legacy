"use client";

import { useState, useTransition } from "react";
import { Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { submitChallengeFeedback } from "../actions";
import { useRouter } from "next/navigation";

const TRUSTPILOT_URL = "https://www.trustpilot.com/review/infinityhoop.com";

export function FeedbackForm({
  challengeMemberId,
  challengeTitle,
}: {
  challengeMemberId: string;
  challengeTitle: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "review_prompt">("form");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [favoritePart, setFavoritePart] = useState("");
  const [improvement, setImprovement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(willReview: boolean) {
    if (rating === 0) {
      setError("Please tap a star to rate the challenge.");
      return;
    }
    if (wouldRecommend === null) {
      setError("Would you recommend this to a friend?");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await submitChallengeFeedback({
        challengeMemberId,
        rating,
        wouldRecommend,
        favoritePart,
        improvement,
        willReview,
      });
      if (!res.ok) {
        setError("Couldn't save your feedback. Try again in a moment.");
        return;
      }
      router.refresh();
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating >= 4) {
      // Show the review prompt — let them choose to leave a public review.
      if (rating === 0) {
        setError("Please tap a star to rate the challenge.");
        return;
      }
      if (wouldRecommend === null) {
        setError("Would you recommend this to a friend?");
        return;
      }
      setError(null);
      setStep("review_prompt");
      return;
    }
    submit(false);
  }

  if (step === "review_prompt") {
    return (
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold">
          You loved {challengeTitle.split(" ").slice(0, 4).join(" ")} 💜
        </h2>
        <p className="mt-2 text-muted-foreground">
          Would you tell other women about it on Trustpilot? It takes 2 minutes
          and seriously changes the lives of the women who find this next.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            variant="gradient"
            disabled={isPending}
            onClick={() => {
              submit(true);
              window.open(TRUSTPILOT_URL, "_blank", "noopener,noreferrer");
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-1 size-4 animate-spin" /> Saving…
              </>
            ) : (
              <>Yes — open Trustpilot →</>
            )}
          </Button>
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => submit(false)}
          >
            Maybe later
          </Button>
        </div>
        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold">How did it feel?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Two minutes of feedback shapes what we build next. Thank you 💜
        </p>
      </div>

      {/* Rating */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Overall rating
        </label>
        <div className="mt-2 flex justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = (hover || rating) >= n;
            return (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                className={cn(
                  "rounded-full p-1.5 transition-transform hover:scale-110",
                  filled ? "text-primary" : "text-muted-foreground/40"
                )}
              >
                <Star
                  className={cn("size-9", filled && "fill-current")}
                  strokeWidth={1.5}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Recommend */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Would you recommend this to a friend?
        </label>
        <div className="mt-2 flex justify-center gap-2">
          {[
            { v: true, label: "Yes, definitely" },
            { v: false, label: "Not yet" },
          ].map((opt) => (
            <button
              key={String(opt.v)}
              type="button"
              onClick={() => setWouldRecommend(opt.v)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                wouldRecommend === opt.v
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background text-foreground/70 hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Favorite part */}
      <div>
        <label
          htmlFor="favorite"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          What was your favorite part?
        </label>
        <Textarea
          id="favorite"
          value={favoritePart}
          onChange={(e) => setFavoritePart(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="The community? A workout? Your buddy?"
          className="mt-2"
        />
      </div>

      {/* Improvement */}
      <div>
        <label
          htmlFor="improvement"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          What would have made it 10× better?
        </label>
        <Textarea
          id="improvement"
          value={improvement}
          onChange={(e) => setImprovement(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Be honest — we read every word."
          className="mt-2"
        />
      </div>

      {error && (
        <p className="text-center text-xs text-destructive">{error}</p>
      )}

      <Button
        type="submit"
        variant="gradient"
        size="lg"
        disabled={isPending}
        className="w-full"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-1 size-4 animate-spin" /> Saving…
          </>
        ) : (
          <>Submit feedback</>
        )}
      </Button>
    </form>
  );
}
