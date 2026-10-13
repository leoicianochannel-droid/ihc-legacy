import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db, users, giftClaims } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getGiftStatus, getDbMilestones } from "@/lib/gifts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Lock, Gift, Sparkles, Truck } from "lucide-react";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function GiftsPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) redirect("/onboarding");

  const [claims, milestones] = await Promise.all([
    db.select().from(giftClaims).where(eq(giftClaims.userId, me.id)),
    getDbMilestones(),
  ]);
  const status = getGiftStatus(me.onboardedAt ?? me.createdAt, claims, milestones);

  const claimMap = new Map(claims.map((c) => [c.milestoneKey, c]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-10 md:py-8">

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-primary p-8 text-white md:p-10">
        <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent" />
        <div className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-white/10" />
        <div className="relative">
          <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/20">
            <Gift className="mr-1 size-3" /> Free Gifts
          </Badge>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight">
            Stay consistent,<br />earn free gifts
          </h1>
          <p className="mt-2 max-w-md text-base opacity-90">
            The longer you stay, the more you get. Physical products and free membership shipped right to your door — just for showing up.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2 backdrop-blur">
              <Sparkles className="size-4" />
              <span className="font-semibold">Day {status.daysMember}</span>
            </div>
            {status.nextUpcoming && (
              <div className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2 backdrop-blur">
                <Gift className="size-4" />
                <span className="font-semibold">
                  {status.nextUpcoming.milestone.emoji} {status.nextUpcoming.milestone.label} in{" "}
                  {status.nextUpcoming.daysLeft} day{status.nextUpcoming.daysLeft !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative mt-10 space-y-4">
        {/* Vertical line */}
        <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-border" />

        {milestones.map((milestone) => {
          const claim = claimMap.get(milestone.key);
          const isUnlocked = status.daysMember >= milestone.dayThreshold;
          const isClaimed = !!claim?.claimedAt;
          const isShipped = !!claim?.shippedAt;
          const daysLeft = milestone.dayThreshold - status.daysMember;
          const isAutoSent = isUnlocked && !isClaimed;

          return (
            <Card
              key={milestone.key}
              className={`relative overflow-hidden transition-all ${
                isAutoSent
                  ? "border-primary/50 ring-2 ring-primary/20"
                  : isClaimed
                  ? "opacity-80"
                  : "opacity-60"
              }`}
            >
              <CardContent className="flex gap-4 p-5">
                {/* Timeline dot */}
                <div className="relative z-10 shrink-0">
                  <div
                    className={`flex size-10 items-center justify-center rounded-full border-2 ${
                      isClaimed
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : isAutoSent
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-border bg-background"
                    }`}
                  >
                    {isClaimed || isAutoSent ? (
                      <Truck className="size-5" />
                    ) : isUnlocked ? (
                      <Gift className="size-5" />
                    ) : (
                      <Lock className="size-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-lg font-bold">
                          {milestone.emoji} {milestone.fullLabel}
                        </span>
                        {isClaimed && (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 text-[10px]">
                            <Check className="mr-1 size-2.5" />
                            {isShipped ? "Shipped" : "Sent"}
                          </Badge>
                        )}
                        {isAutoSent && (
                          <Badge className="bg-emerald-500 text-white text-[10px]">
                            <Truck className="mr-1 size-2.5" /> On its way!
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {milestone.description}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-primary">
                        {milestone.retailValue} value — yours free at day {milestone.dayThreshold}
                      </p>
                    </div>

                    {milestone.image && (
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border bg-muted">
                        <Image
                          src={milestone.image}
                          alt={milestone.label}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                  </div>

                  {/* Status row */}
                  <div className="mt-3">
                    {isAutoSent ? (
                      <p className="text-xs text-muted-foreground">
                        <Truck className="mr-1 inline size-3" />
                        Automatically sent via Skio to your address on file.
                      </p>
                    ) : isClaimed ? (
                      <p className="text-xs text-muted-foreground">
                        Sent on {new Date(claim.claimedAt!).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                        {isShipped && ` · Shipped ${new Date(claim.shippedAt!).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`}
                      </p>
                    ) : (
                      <div className="flex items-center gap-3">
                        {/* Progress bar */}
                        <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-primary/40 transition-all"
                            style={{
                              width: `${Math.min(100, (status.daysMember / milestone.dayThreshold) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground shrink-0">
                          {daysLeft} day{daysLeft !== 1 ? "s" : ""} to go
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Gifts are automatically sent via Skio to your address on file once you reach each milestone. Free month is applied to your next billing cycle.
      </p>
    </div>
  );
}
