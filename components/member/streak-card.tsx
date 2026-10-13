import { Card } from "@/components/ui/card";
import { Flame, Snowflake, AlertTriangle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const MILESTONE_DAYS = 7;

/**
 * Hero streak card. Three visual states:
 *  - "fresh" — streak completed today (logged in green)
 *  - "at-risk" — streak alive but no activity yet today (amber pulse)
 *  - "broken" — streak is 0 (neutral, encourages start)
 *
 * Gamification:
 *  - Big animated streak counter, color-coded by tier (10+ = pink, 30+ = gradient)
 *  - Freeze token snowflakes (visible inventory)
 *  - Progress bar toward next freeze-token milestone (every 7 days)
 *  - "Save your streak today" CTA when at-risk
 */
export function StreakCard({
  current,
  longest,
  freezeTokens,
  lastActionToday,
}: {
  current: number;
  longest: number;
  freezeTokens: number;
  lastActionToday: boolean;
}) {
  const atRisk = current > 0 && !lastActionToday;
  const broken = current === 0;

  const milestonesEarned = Math.floor(current / MILESTONE_DAYS);
  const daysIntoMilestone = current % MILESTONE_DAYS;
  const daysToNextMilestone = MILESTONE_DAYS - daysIntoMilestone;
  const milestoneProgress = (daysIntoMilestone / MILESTONE_DAYS) * 100;

  // Tier accent — bigger streaks earn fancier color treatment
  const tier =
    current >= 30 ? "legend" : current >= 14 ? "champion" : current >= 7 ? "mover" : "starter";
  const counterClass = cn(
    "font-display text-6xl font-bold leading-none transition-colors",
    tier === "legend" && "text-primary",
    tier === "champion" && "text-primary",
    tier === "mover" && "text-foreground",
    tier === "starter" && "text-foreground"
  );

  return (
    <Card
      className={cn(
        "relative overflow-hidden p-6 transition-shadow",
        atRisk && "ring-2 ring-amber-400 ring-offset-2"
      )}
    >
      {/* Decorative blur */}
      {lastActionToday && (
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-primary/15 blur-3xl" />
      )}
      {atRisk && (
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-amber-400/20 blur-3xl" />
      )}

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <Flame
              className={cn(
                "size-4",
                broken ? "text-muted-foreground" : "text-primary"
              )}
            />
            {broken ? "Start your streak" : "Current streak"}
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className={counterClass}>{current}</span>
            <span className="text-muted-foreground">
              day{current === 1 ? "" : "s"}
            </span>
            {tier !== "starter" && current >= 7 && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                <Trophy className="size-3" /> {tier}
              </span>
            )}
          </div>

          {/* Status copy */}
          {lastActionToday && (
            <p className="mt-2 text-xs font-semibold text-emerald-700">
              ✓ Locked in for today — go you.
            </p>
          )}
          {atRisk && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
              <AlertTriangle className="size-3" /> Save your streak — log
              anything today
            </div>
          )}
          {broken && (
            <p className="mt-2 text-xs text-muted-foreground">
              Hoop today, mark a recipe, or post in community to start.
            </p>
          )}

          {/* Milestone progress */}
          {!broken && (
            <div className="mt-4">
              <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
                <span>
                  {daysToNextMilestone} day{daysToNextMilestone === 1 ? "" : "s"} to next freeze
                </span>
                <span>
                  {milestonesEarned} earned · longest {longest}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${milestoneProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Freeze inventory */}
        <div
          className="flex flex-col items-center gap-1 rounded-2xl border bg-muted/40 p-3"
          title={`${freezeTokens} streak freeze${freezeTokens === 1 ? "" : "s"} — auto-used if you miss a day`}
        >
          <div className="flex gap-0.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Snowflake
                key={i}
                className={cn(
                  "size-4 transition-colors",
                  i < freezeTokens
                    ? "text-sky-500"
                    : "text-muted-foreground/30"
                )}
              />
            ))}
          </div>
          <div className="font-bold">{freezeTokens}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Freezes
          </div>
        </div>
      </div>
    </Card>
  );
}
