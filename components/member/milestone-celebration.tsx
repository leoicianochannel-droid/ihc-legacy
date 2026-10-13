"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { markMilestonesCelebrated } from "@/app/(member)/actions";

export type CelebrationData = {
  day: number;
  allDaysToMark: number[];
  unlockedWorkouts: { title: string; slug: string }[];
  giftEarned: { label: string; emoji: string; fullLabel: string } | null;
};

export function MilestoneCelebration({ data }: { data: CelebrationData }) {
  const [visible, setVisible] = useState(true);
  const [, startTransition] = useTransition();

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
    startTransition(() => markMilestonesCelebrated(data.allDaysToMark));
  }

  const hasWorkouts = data.unlockedWorkouts.length > 0;
  const hasGift = !!data.giftEarned;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-background p-6 shadow-2xl">
        <div className="text-center">
          <div className="text-5xl">🎉</div>
          <h2 className="mt-3 font-display text-2xl font-bold">You've reached Day {data.day}!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep it up — here's what just unlocked for you.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {hasWorkouts && (
            <div className="rounded-2xl bg-muted/60 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                🔓 New workouts unlocked ({data.unlockedWorkouts.length})
              </p>
              <ul className="space-y-1">
                {data.unlockedWorkouts.slice(0, 5).map((w) => (
                  <li key={w.slug} className="text-sm font-semibold">{w.title}</li>
                ))}
                {data.unlockedWorkouts.length > 5 && (
                  <li className="text-xs text-muted-foreground">
                    + {data.unlockedWorkouts.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          )}

          {hasGift && (
            <div className="rounded-2xl border border-primary/20 bg-primary/8 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-primary/70">
                🎁 Free gift earned!
              </p>
              <p className="font-semibold">
                {data.giftEarned!.emoji} {data.giftEarned!.fullLabel}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {hasGift && (
            <Link href="/gifts" onClick={dismiss} className="block">
              <Button variant="gradient" className="w-full">
                Claim my free gift 🎁
              </Button>
            </Link>
          )}
          {hasWorkouts && (
            <Link href="/workouts" onClick={dismiss} className="block">
              <Button variant={hasGift ? "outline" : "gradient"} className="w-full">
                See new workouts 🔓
              </Button>
            </Link>
          )}
          {!hasWorkouts && !hasGift && (
            <Button variant="gradient" className="w-full" onClick={dismiss}>
              Keep going! 💪
            </Button>
          )}
          <button
            onClick={dismiss}
            className="mt-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
