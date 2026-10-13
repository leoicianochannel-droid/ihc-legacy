import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Truck, Trophy, Check } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { markRewardShipped } from "./actions";
import { CHALLENGE_REWARDS } from "@/lib/challenge-rewards";

export const dynamic = "force-dynamic";

type RewardRow = {
  id: string;
  challenge_slug: string;
  tier_min_completed: number;
  reward_label: string;
  reward_items: string;
  earned_at: Date;
  shipped_at: Date | null;
  admin_notes: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  user_id: string;
};

async function getClaims(): Promise<RewardRow[]> {
  try {
    const result = await db.execute(sql`
      SELECT
        crc.id, crc.challenge_slug, crc.tier_min_completed,
        crc.reward_label, crc.reward_items,
        crc.earned_at, crc.shipped_at, crc.admin_notes,
        u.first_name, u.last_name, u.email, u.id AS user_id
      FROM challenge_reward_claims crc
      JOIN users u ON u.id = crc.user_id
      ORDER BY crc.shipped_at NULLS FIRST, crc.earned_at DESC
    `);
    return result as unknown as RewardRow[];
  } catch {
    return [];
  }
}

function challengeLabel(slug: string): string {
  const labels: Record<string, string> = {
    "21-day-reset": "21 Day Reset",
    "75-hard": "75 Hard",
  };
  return labels[slug] ?? slug;
}

export default async function ChallengeRewardsPage() {
  const claims = await getClaims();

  const pending = claims.filter(c => !c.shipped_at);
  const shipped = claims.filter(c => c.shipped_at);

  const totalByChallengeSlug = Object.fromEntries(
    Object.keys(CHALLENGE_REWARDS).map(slug => [
      slug,
      claims.filter(c => c.challenge_slug === slug).length,
    ])
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
          <Trophy className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Challenge Rewards</h1>
          <p className="text-sm text-muted-foreground">
            Members who&apos;ve earned physical prizes for completing challenge milestones.
          </p>
        </div>
      </div>

      {/* Summary chips */}
      <div className="mb-8 flex flex-wrap gap-3">
        {Object.entries(totalByChallengeSlug).map(([slug, count]) => (
          <div key={slug} className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-semibold">
            <Gift className="size-3.5 text-muted-foreground" />
            {challengeLabel(slug)}: {count} earned
          </div>
        ))}
        <div className="flex items-center gap-2 rounded-full border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
          <Truck className="size-3.5" />
          {pending.length} to ship
        </div>
      </div>

      {/* ── Needs Shipping ───────────────────────────────────────── */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <Truck className="size-4 text-orange-500" />
          <h2 className="font-display text-lg font-bold">Needs Shipping</h2>
          {pending.length > 0 && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              All rewards have been shipped — you&apos;re all caught up!
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pending.map(row => (
              <Card key={row.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-semibold">
                          {row.first_name ?? "Member"} {row.last_name ?? ""}
                        </span>
                        <span className="text-xs text-muted-foreground">{row.email}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                          {challengeLabel(row.challenge_slug)}
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {row.reward_label}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        🎁 {row.reward_items}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Earned {formatDate(row.earned_at, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      {row.admin_notes && (
                        <p className="mt-1 text-xs italic text-muted-foreground">
                          Note: {row.admin_notes}
                        </p>
                      )}
                    </div>
                    <form action={markRewardShipped.bind(null, row.id)}>
                      <Button type="submit" size="sm" variant="gradient" className="shrink-0">
                        <Truck className="mr-1.5 size-3.5" /> Mark Shipped
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Shipped ──────────────────────────────────────────────── */}
      {shipped.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Check className="size-4 text-green-600" />
            <h2 className="font-display text-lg font-bold">Shipped</h2>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700 dark:bg-green-900/40 dark:text-green-400">
              {shipped.length}
            </span>
          </div>
          <div className="space-y-2">
            {shipped.map(row => (
              <Card key={row.id} className="opacity-70">
                <CardContent className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold text-sm">
                        {row.first_name ?? "Member"} {row.last_name ?? ""}
                      </span>
                      <span className="text-xs text-muted-foreground">{row.email}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {challengeLabel(row.challenge_slug)} · {row.reward_label} · {row.reward_items}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-green-600 font-semibold">
                    Shipped {row.shipped_at ? formatDate(row.shipped_at, { month: "short", day: "numeric" }) : ""}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
