"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Trophy, Star } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  decemberCheckins: number;
};

const STORAGE_KEY = "december-challenge-banner-dismissed-2026";
const CONTEST_START = new Date("2026-12-01T00:00:00");
const CONTEST_END = new Date("2026-12-31T23:59:59");

export function DecemberChallengeBanner({ userId, decemberCheckins }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {}
  }, []);

  if (!mounted || dismissed) return null;

  const now = new Date();
  const contestLive = now >= CONTEST_START && now <= CONTEST_END;

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setDismissed(true);
  }

  return (
    <div className="mx-5 mb-4 overflow-hidden rounded-2xl border border-amber-300/60 bg-gradient-to-br from-amber-50 to-orange-50 dark:border-amber-700/40 dark:from-amber-950/40 dark:to-orange-950/40">
      {/* Top strip */}
      <div className="flex items-center justify-between gap-2 bg-amber-500/10 px-4 py-2.5 dark:bg-amber-500/15">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
          <Trophy className="size-3" />
          December Flow Challenge
        </span>
        <button
          onClick={dismiss}
          className="rounded-full p-1 text-amber-600/70 hover:text-amber-800 transition-colors dark:text-amber-400/70 dark:hover:text-amber-300"
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <p className="text-sm font-bold text-gray-900 dark:text-amber-50">
          $500 in prizes — two ways to win
        </p>

        <div className="mt-2 flex flex-col gap-1.5">
          <div className="flex items-start gap-2 text-[13px] text-gray-700 dark:text-amber-100/80">
            <Trophy className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
            <span>
              <strong>Most check-ins</strong> in December → $250
            </span>
          </div>
          <div className="flex items-start gap-2 text-[13px] text-gray-700 dark:text-amber-100/80">
            <Star className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
            <span>
              <strong>Best community post</strong> about your journey → $250
            </span>
          </div>
        </div>

        {contestLive ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="rounded-xl bg-amber-500/15 px-3 py-1.5 dark:bg-amber-500/20">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Your check-ins
              </span>
              <div className="font-display text-2xl font-bold leading-none text-amber-700 dark:text-amber-300">
                {decemberCheckins}
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Link
                href="/community"
                className={cn(
                  "rounded-xl bg-amber-500 px-4 py-2 text-center text-[13px] font-bold text-white",
                  "hover:bg-amber-600 transition-colors"
                )}
              >
                Log today's workout →
              </Link>
              <Link
                href="/community/december-challenge"
                className="text-center text-[11px] font-semibold text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
              >
                Contest rules
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-400">
              Starts December 1st — watch for the flow video drop today 🎁
            </p>
            <Link
              href="/community/december-challenge"
              className="shrink-0 text-[11px] font-semibold text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
            >
              Rules →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
