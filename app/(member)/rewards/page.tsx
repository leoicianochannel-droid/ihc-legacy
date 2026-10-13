import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db, users, tierUnlocks } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TIER_CONFIG, type Tier, tierProgress, getTierStats } from "@/lib/tiers";
import { Check, Lock, Gift, Sparkles, Copy } from "lucide-react";
import { CopyCodeButton } from "./copy-code";

export const dynamic = "force-dynamic";

const TIER_ORDER: Tier[] = ["starter", "mover", "champion", "legend"];

export default async function RewardsPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) redirect("/onboarding");

  const stats = await getTierStats(me.id);
  const myTier = me.tier as Tier;
  const progress = tierProgress(myTier, stats.workouts, stats.longestStreak);

  const unlocks = await db
    .select()
    .from(tierUnlocks)
    .where(eq(tierUnlocks.userId, me.id))
    .orderBy(asc(tierUnlocks.unlockedAt));
  const unlockedTiers = new Set(unlocks.map((u) => u.tier as Tier));

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-10 md:py-8">
      {/* Hero — current tier */}
      <div className="relative overflow-hidden rounded-3xl hoop-gradient-bold p-8 text-white">
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="relative">
          <Badge variant="gold" className="uppercase tracking-wider">
            <Sparkles className="mr-1 size-3" /> Rewards
          </Badge>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-6xl">{TIER_CONFIG[myTier].emoji}</span>
            <div>
              <h1 className="font-display text-4xl font-bold">{TIER_CONFIG[myTier].name}</h1>
              <p className="text-sm opacity-90">Your current tier</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 max-w-md">
            <div className="rounded-xl bg-white/15 p-3 backdrop-blur">
              <div className="text-[10px] uppercase tracking-wider opacity-80">
                Workouts done
              </div>
              <div className="mt-1 font-display text-2xl font-bold">{stats.workouts}</div>
            </div>
            <div className="rounded-xl bg-white/15 p-3 backdrop-blur">
              <div className="text-[10px] uppercase tracking-wider opacity-80">
                Longest streak
              </div>
              <div className="mt-1 font-display text-2xl font-bold">{stats.longestStreak}</div>
            </div>
          </div>

          {progress.next && (
            <div className="mt-6 max-w-md">
              <div className="flex items-end justify-between text-xs">
                <span>
                  Progress to <strong>{TIER_CONFIG[progress.next].emoji} {TIER_CONFIG[progress.next].name}</strong>
                </span>
                <span className="font-bold">{progress.pct}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full bg-white transition-all"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
              <p className="mt-2 text-xs opacity-90">
                {progress.workoutsToGo > 0 && (
                  <>
                    <strong>{progress.workoutsToGo} more workouts</strong> or a{" "}
                    <strong>{TIER_CONFIG[progress.next].streakRequired}-day streak</strong> unlocks{" "}
                    a {TIER_CONFIG[progress.next].discount}% off code
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* All tiers + perks */}
      <h2 className="mt-10 mb-4 font-display text-2xl font-bold">All tiers</h2>
      <div className="space-y-4">
        {TIER_ORDER.map((t) => {
          const cfg = TIER_CONFIG[t];
          const isUnlocked = unlockedTiers.has(t) || t === "starter";
          const isMine = t === myTier;
          const isLocked = !isUnlocked;

          return (
            <Card
              key={t}
              className={`overflow-hidden transition-all ${
                isMine ? "border-primary/40 ring-2 ring-primary/20" : ""
              } ${isLocked ? "opacity-75" : ""}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="text-4xl">{cfg.emoji}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-xl font-bold">{cfg.name}</h3>
                        {isMine && <Badge variant="default">YOU ARE HERE</Badge>}
                        {isUnlocked && !isMine && (
                          <Badge variant="outline" className="border-primary/40 text-primary">
                            <Check className="mr-1 size-3" /> Unlocked
                          </Badge>
                        )}
                        {isLocked && (
                          <Badge variant="outline" className="text-muted-foreground">
                            <Lock className="mr-1 size-3" /> Locked
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t === "starter"
                          ? "Default tier — just sign up"
                          : `Unlock by completing ${cfg.workoutsRequired} workouts OR reaching a ${cfg.streakRequired}-day streak`}
                      </div>
                    </div>
                  </div>
                </div>

                <ul className="mt-4 space-y-1.5">
                  {cfg.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2 text-sm">
                      <Gift className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>

                {/* Discount code reveal — only shown if unlocked */}
                {cfg.discountCode && isUnlocked && (
                  <div className="mt-4 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                          Your discount code
                        </div>
                        <div className="mt-1 font-mono text-2xl font-bold tracking-wider">
                          {cfg.discountCode}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Use at infinityhoop.com checkout — {cfg.discount}% off any purchase. One-time use.
                        </p>
                      </div>
                      <CopyCodeButton code={cfg.discountCode} />
                    </div>
                  </div>
                )}

                {/* Locked discount preview */}
                {cfg.discountCode && isLocked && (
                  <div className="mt-4 rounded-xl border bg-muted/30 p-4 text-sm">
                    <div className="flex items-center gap-2 font-semibold">
                      <Lock className="size-4" /> {cfg.discount}% off code locked
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Reach this tier to unlock your discount code.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Tier rewards are tracked automatically based on your workouts + streak. Free physical
        products at Champion + Legend are shipped manually — we'll email you when you unlock them.
      </p>
    </div>
  );
}
