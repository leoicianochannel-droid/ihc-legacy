import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TIER_CONFIG, type Tier, tierProgress } from "@/lib/tiers";
import { ChevronRight } from "lucide-react";

export function TierCard({
  tier,
  workouts,
  longestStreak,
}: {
  tier: Tier;
  workouts: number;
  longestStreak: number;
}) {
  const cfg = TIER_CONFIG[tier];
  const progress = tierProgress(tier, workouts, longestStreak);
  const nextCfg = progress.next ? TIER_CONFIG[progress.next] : null;

  return (
    <Link href="/rewards" className="block">
      <Card className="relative overflow-hidden transition-all hover:shadow-md">
        <div className="absolute inset-0 hoop-gradient opacity-30" aria-hidden />
        <div className="relative p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your tier
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-3xl">{cfg.emoji}</span>
                <span className="font-display text-2xl font-bold">{cfg.name}</span>
              </div>
            </div>
            <ChevronRight className="size-5 text-muted-foreground" />
          </div>

          {nextCfg && progress.next ? (
            <div className="mt-4">
              <div className="flex items-end justify-between text-xs">
                <span className="text-muted-foreground">
                  Next: {nextCfg.emoji} <strong className="text-foreground">{nextCfg.name}</strong>
                </span>
                <span className="font-semibold text-primary">{progress.pct}%</span>
              </div>
              <Progress value={progress.pct} className="mt-1.5" />
              <p className="mt-2 text-xs text-muted-foreground">
                {progress.workoutsToGo > 0 && progress.streakToGo > 0
                  ? `${progress.workoutsToGo} more workouts OR a ${nextCfg.streakRequired}-day streak unlocks a ${nextCfg.discount}% off code`
                  : `One more milestone away from a ${nextCfg.discount}% off code!`}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-xs font-semibold text-primary">
              👑 Top tier unlocked. You're a legend.
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}
