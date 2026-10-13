"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Flame, Dumbbell, CalendarDays, Trophy, Loader2, X } from "lucide-react";
import { getRetentionStats, type RetentionStats } from "@/lib/retention-stats";

const SUBSCRIPTION_URL = "https://www.infinityhoop.com/a/account/subscriptions";

interface RetentionModalProps {
  /** Text shown on the trigger button */
  label?: string;
  variant?: "gradient" | "outline" | "ghost";
  size?: "sm" | "default";
  className?: string;
}

export function ManageSubscriptionButton({
  label = "Manage subscription",
  variant = "outline",
  size = "sm",
  className,
}: RetentionModalProps) {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<RetentionStats | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpen() {
    startTransition(async () => {
      const data = await getRetentionStats();
      setStats(data);
      setOpen(true);
    });
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleOpen}
        disabled={pending}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {label}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-primary px-6 py-8 text-white">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
              <p className="text-sm font-bold uppercase tracking-wider opacity-80">
                Wait —
              </p>
              <h2 className="mt-1 font-display text-3xl font-bold">
                Look how far you've come{stats?.firstName ? `, ${stats.firstName}` : ""}! 💫
              </h2>
              <p className="mt-2 text-sm opacity-90">
                Here's what you've built since joining Infinity Hoop.
              </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 p-6">
              <StatTile
                icon={<Dumbbell className="size-5 text-primary" />}
                value={stats?.workoutsCompleted ?? 0}
                label="Workouts completed"
              />
              <StatTile
                icon={<Flame className="size-5 text-orange-500" />}
                value={stats?.currentStreak ?? 0}
                label="Current streak"
                unit="days"
              />
              <StatTile
                icon={<Trophy className="size-5 text-amber-500" />}
                value={stats?.longestStreak ?? 0}
                label="Longest streak"
                unit="days"
              />
              <StatTile
                icon={<CalendarDays className="size-5 text-primary" />}
                value={stats?.daysAsMember ?? 0}
                label="Days as a member"
              />
            </div>

            {/* Copy */}
            <div className="border-t px-6 pb-2 pt-4 text-sm text-muted-foreground">
              {stats?.memberSince && (
                <p className="mb-2 text-xs">
                  Member since <strong className="text-foreground">{stats.memberSince}</strong>
                </p>
              )}
              <p>
                Every session stacks. Every streak counts. The results you're working toward are closer than they were on day one.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 px-6 pb-6 pt-4">
              <Button
                variant="gradient"
                className="w-full"
                onClick={() => setOpen(false)}
              >
                Stay and keep going 💪
              </Button>
              <a
                href={SUBSCRIPTION_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="w-full text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Continue to manage subscription →
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatTile({
  icon,
  value,
  label,
  unit,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  unit?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border bg-muted/30 p-4">
      {icon}
      <div className="mt-1 font-display text-3xl font-bold leading-none">
        {value}
        {unit && <span className="ml-1 text-base font-normal text-muted-foreground">{unit}</span>}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
