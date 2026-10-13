import Link from "next/link";
import { db, users, giftClaims, giftMilestones } from "@/lib/db";
import { asc, eq, isNotNull, isNull, and } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Gift, Truck, Unlock, Clock, ArrowLeft, Settings } from "lucide-react";
import { getDbMilestones, getGiftStatus, daysSince } from "@/lib/gifts";
import type { GiftClaim } from "@/lib/db/schema";
import { markShipped } from "./actions";

export const dynamic = "force-dynamic";

const COMING_UP_DAYS = 30;

export default async function GiftProgressPage() {
  const [milestones, allUsers, allClaimsRaw, pendingShipments] = await Promise.all([
    getDbMilestones(),
    db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        onboardedAt: users.onboardedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.createdAt)),
    db.select().from(giftClaims),
    db
      .select({
        claimId: giftClaims.id,
        claimedAt: giftClaims.claimedAt,
        shippingName: giftClaims.shippingName,
        shippingLine1: giftClaims.shippingLine1,
        shippingLine2: giftClaims.shippingLine2,
        shippingCity: giftClaims.shippingCity,
        shippingState: giftClaims.shippingState,
        shippingZip: giftClaims.shippingZip,
        shippingCountry: giftClaims.shippingCountry,
        adminNotes: giftClaims.adminNotes,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        milestoneLabel: giftMilestones.fullLabel,
        milestoneEmoji: giftMilestones.emoji,
      })
      .from(giftClaims)
      .innerJoin(users, eq(users.id, giftClaims.userId))
      .innerJoin(giftMilestones, eq(giftMilestones.key, giftClaims.milestoneKey))
      .where(
        and(
          isNotNull(giftClaims.claimedAt),
          isNull(giftClaims.shippedAt),
          eq(giftMilestones.requiresShipping, true)
        )
      )
      .orderBy(asc(giftClaims.claimedAt)),
  ]);

  // Build claimsByUser map
  const claimsByUser = new Map<string, GiftClaim[]>();
  for (const c of allClaimsRaw) {
    const list = claimsByUser.get(c.userId) ?? [];
    list.push(c);
    claimsByUser.set(c.userId, list);
  }

  // Categorise every member
  type UserRow = (typeof allUsers)[number];
  const readyToClaim: { user: UserRow; milestones: ReturnType<typeof getGiftStatus>["readyToClaim"]; daysMember: number }[] = [];
  const comingUpSoon: { user: UserRow; daysLeft: number; nextLabel: string; nextEmoji: string; daysMember: number }[] = [];

  for (const u of allUsers) {
    const startDate = u.onboardedAt ?? u.createdAt;
    const status = getGiftStatus(startDate, claimsByUser.get(u.id) ?? [], milestones);

    if (status.readyToClaim.length > 0) {
      readyToClaim.push({ user: u, milestones: status.readyToClaim, daysMember: status.daysMember });
    }

    if (status.nextUpcoming && status.nextUpcoming.daysLeft <= COMING_UP_DAYS) {
      comingUpSoon.push({
        user: u,
        daysLeft: status.nextUpcoming.daysLeft,
        nextLabel: status.nextUpcoming.milestone.fullLabel,
        nextEmoji: status.nextUpcoming.milestone.emoji,
        daysMember: status.daysMember,
      });
    }
  }

  comingUpSoon.sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <Gift className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Gift Progress</h1>
            <p className="text-sm text-muted-foreground">
              Pending shipments, unclaimed gifts, and members approaching milestones.
            </p>
          </div>
        </div>
        <Link href="/admin/gifts">
          <Button variant="outline" size="sm" className="shrink-0">
            <Settings className="mr-1.5 size-3.5" /> Gift Settings
          </Button>
        </Link>
      </div>

      {/* ── Section 1: Needs Shipping ─────────────────────────────────────── */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <Truck className="size-4 text-orange-500" />
          <h2 className="font-display text-lg font-bold">Needs Shipping</h2>
          {pendingShipments.length > 0 && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
              {pendingShipments.length}
            </span>
          )}
        </div>

        {pendingShipments.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No pending shipments — you're all caught up.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingShipments.map((row) => (
              <Card key={row.claimId}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-semibold">
                          {row.firstName ?? "Member"} {row.lastName ?? ""}
                        </span>
                        <span className="text-xs text-muted-foreground">{row.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                        <span>{row.milestoneEmoji}</span>
                        <span>{row.milestoneLabel}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Claimed{" "}
                        {row.claimedAt
                          ? formatDate(row.claimedAt, { month: "short", day: "numeric" })
                          : "—"}
                      </p>
                      {row.shippingName && (
                        <div className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-foreground/80">
                          <p className="font-semibold">{row.shippingName}</p>
                          <p>{row.shippingLine1}</p>
                          {row.shippingLine2 && <p>{row.shippingLine2}</p>}
                          <p>
                            {row.shippingCity}, {row.shippingState} {row.shippingZip}
                          </p>
                          {row.shippingCountry && row.shippingCountry !== "US" && (
                            <p>{row.shippingCountry}</p>
                          )}
                        </div>
                      )}
                    </div>
                    <form action={markShipped.bind(null, row.claimId)}>
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

      {/* ── Section 2: Ready to Claim ─────────────────────────────────────── */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <Unlock className="size-4 text-green-600" />
          <h2 className="font-display text-lg font-bold">Ready to Claim</h2>
          {readyToClaim.length > 0 && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700 dark:bg-green-900/40 dark:text-green-400">
              {readyToClaim.length}
            </span>
          )}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          These members have earned a gift but haven't claimed it yet. Consider sending a reminder.
        </p>

        {readyToClaim.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No unclaimed gifts right now.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {readyToClaim.map(({ user: u, milestones: earned, daysMember }) => (
              <Card key={u.id}>
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold">
                        {u.firstName ?? "Member"} {u.lastName ?? ""}
                      </span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {earned.map((m) => (
                        <span
                          key={m.key}
                          className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-300"
                        >
                          {m.emoji} {m.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Day {daysMember}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 3: Coming Up Soon ─────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Clock className="size-4 text-blue-500" />
          <h2 className="font-display text-lg font-bold">Coming Up in {COMING_UP_DAYS} Days</h2>
          {comingUpSoon.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
              {comingUpSoon.length}
            </span>
          )}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Sorted by closest milestone first. Great time to send a hype message.
        </p>

        {comingUpSoon.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No members within {COMING_UP_DAYS} days of a gift right now.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {comingUpSoon.map(({ user: u, daysLeft, nextLabel, nextEmoji, daysMember }) => (
              <Card key={u.id}>
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold">
                        {u.firstName ?? "Member"} {u.lastName ?? ""}
                      </span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <span>{nextEmoji}</span>
                      <span>{nextLabel}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-muted-foreground">Day {daysMember}</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        daysLeft <= 7
                          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                          : daysLeft <= 14
                          ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                      }`}
                    >
                      {daysLeft === 0 ? "today!" : daysLeft === 1 ? "tomorrow!" : `${daysLeft}d left`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
