import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db, users, giftClaims } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getGiftStatus, getDbMilestones } from "@/lib/gifts";
import { Check, Lock, Sparkles, Truck } from "lucide-react";
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
  const unlockedCount = milestones.filter((m) => status.daysMember >= m.dayThreshold).length;
  const fmt = (d: Date | string, withYear = false) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-10 md:py-8">
      {/* Header */}
      <h1 className="font-display text-4xl font-bold">Free gifts</h1>
      <p className="mt-1 text-muted-foreground">The longer you stay, the more we send you.</p>

      {/* Summary */}
      <div className="mt-5 flex items-center gap-4 rounded-2xl bg-primary px-5 py-4 text-primary-foreground">
        <div className="shrink-0">
          <p className="font-display text-3xl font-bold leading-none">Day {status.daysMember}</p>
          <p className="mt-1 text-xs opacity-80">with Infinity Hoop</p>
        </div>
        <div className="h-10 w-px shrink-0 bg-white/25" />
        <p className="min-w-0 text-sm font-semibold leading-snug">
          {status.nextUpcoming ? (
            <>
              Next: {status.nextUpcoming.milestone.label}
              <span className="block font-normal opacity-80">
                in {status.nextUpcoming.daysLeft} day{status.nextUpcoming.daysLeft !== 1 ? "s" : ""}
              </span>
            </>
          ) : (
            <>
              <Sparkles className="mr-1 inline size-4" />
              {unlockedCount > 0 ? "Every gift unlocked" : "Gifts coming soon"}
              <span className="block font-normal opacity-80">Thanks for showing up.</span>
            </>
          )}
        </p>
      </div>

      {/* Gift list */}
      <ul className="mt-6 divide-y overflow-hidden rounded-2xl border bg-card">
        {milestones.map((milestone) => {
          const claim = claimMap.get(milestone.key);
          const isUnlocked = status.daysMember >= milestone.dayThreshold;
          const isClaimed = !!claim?.claimedAt;
          const isShipped = !!claim?.shippedAt;
          const daysLeft = milestone.dayThreshold - status.daysMember;
          const isOnItsWay = isUnlocked && !isClaimed;

          return (
            <li key={milestone.key} className="flex items-center gap-3 p-4">
              {/* Thumbnail */}
              <div
                className={`relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted text-2xl ${
                  isUnlocked ? "" : "opacity-60 grayscale"
                }`}
              >
                {milestone.image ? (
                  <Image src={milestone.image} alt="" fill className="object-cover" unoptimized />
                ) : (
                  <span aria-hidden>{milestone.emoji}</span>
                )}
              </div>

              {/* Name + value / progress */}
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug">{milestone.label}</p>
                <p className="text-xs text-muted-foreground">
                  Day {milestone.dayThreshold} · {milestone.retailValue} value
                </p>
                {!isUnlocked && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/50"
                      style={{ width: `${Math.min(100, (status.daysMember / milestone.dayThreshold) * 100)}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="shrink-0 text-right">
                {isClaimed ? (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      <Check className="size-3" /> {isShipped ? "Shipped" : "Sent"}
                    </span>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {fmt(isShipped ? claim!.shippedAt! : claim!.claimedAt!)}
                    </p>
                  </>
                ) : isOnItsWay ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <Truck className="size-3" /> On its way
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                    <Lock className="size-3" /> {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 px-1 text-xs text-muted-foreground">
        Gifts ship automatically to your address on file. Your free month is applied to your next bill.
      </p>
    </div>
  );
}
