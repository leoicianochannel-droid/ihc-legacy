"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, ArrowRight } from "lucide-react";

const CHALLENGE_START = new Date("2026-07-01T00:00:00Z");
const CHALLENGE_END   = new Date("2026-07-30T23:59:59Z");
const STORAGE_KEY     = "challenge-banner-dismissed-july26";

export function ChallengeBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [phase, setPhase] = useState<"pre" | "live" | "over">("pre");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setDismissed(true);
    } catch {}

    const now = Date.now();
    if (now >= CHALLENGE_END.getTime()) setPhase("over");
    else if (now >= CHALLENGE_START.getTime()) setPhase("live");
    else setPhase("pre");

    setMounted(true);
  }, []);

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setDismissed(true);
  }

  if (!mounted || dismissed || phase === "over") return null;

  return (
    <div className="fixed inset-x-0 bottom-[56px] z-30 border-t border-white/10 bg-black/80 px-4 py-2.5 text-white backdrop-blur-md md:bottom-0 md:px-8">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-1/2 -translate-y-1/2 flex size-7 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/15 hover:text-white"
      >
        <X className="size-4" />
      </button>

      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 pr-8">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-base leading-none">🏆</span>
          <span className="font-semibold">
            {phase === "pre"
              ? "30-Day Challenge · Starts July 1"
              : "30-Day Challenge is live!"}
          </span>
        </div>

        <Link
          href="/challenges/30-day-challenge"
          className="flex shrink-0 items-center gap-1 text-xs font-bold text-white/80 transition-colors hover:text-white"
        >
          {phase === "pre" ? "Learn more" : "Join now"}
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
