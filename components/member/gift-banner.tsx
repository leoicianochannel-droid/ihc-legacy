"use client";

import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { useState } from "react";
import type { GiftStatus } from "@/lib/gifts";

export function GiftBanner({ status }: { status: GiftStatus }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (status.allComplete && status.readyToClaim.length === 0) return null;

  // ── Priority 1: milestone reached ──────────────────────────────────────
  if (status.readyToClaim.length > 0) {
    const gift = status.readyToClaim[0];
    return (
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 md:px-8">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <span className="text-xl shrink-0">{gift.emoji}</span>
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold text-amber-900">
              Your free {gift.label} is on its way!
            </span>
            <span className="ml-2 text-xs text-amber-700 opacity-80">
              Day {gift.dayThreshold} reached — shipping automatically.
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 rounded-full p-1 text-amber-600 hover:bg-amber-100"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Priority 2: countdown to next gift ──────────────────────────────────
  if (status.nextUpcoming) {
    const { milestone, daysLeft } = status.nextUpcoming;
    if (daysLeft > 14) return null; // only show when close

    return (
      <Link
        href="/gifts"
        className="group block border-b border-primary/10 bg-primary/5 px-4 py-2 md:px-8"
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-base leading-none">{milestone.emoji}</span>
            <span className="font-medium text-foreground">
              {daysLeft === 1
                ? `Free ${milestone.label} tomorrow!`
                : daysLeft <= 7
                ? `Free ${milestone.label} in ${daysLeft} days`
                : `Next free gift in ${daysLeft} days`}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary group-hover:underline">
            See all <ArrowRight className="size-3" />
          </div>
        </div>
      </Link>
    );
  }

  return null;
}
