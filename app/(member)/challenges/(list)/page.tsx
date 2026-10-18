import Link from "next/link";
import { WorkoutsHeader } from "@/components/member/workouts-section";
import { ProgramCard } from "@/components/member/program-card";
import { db, challenges, challengeMembers, programs, programMembers } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { and, or, eq, asc, isNull, lte, sql } from "drizzle-orm";
import { db as d, users } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Calendar, Gift, ArrowRight, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ChallengesPage() {
  const { userId: clerkId } = await auth();
  const [me] = clerkId
    ? await d.select().from(users).where(eq(users.clerkId, clerkId)).limit(1)
    : [null];

  const now = new Date();
  const active = await db
    .select()
    .from(challenges)
    .where(
      and(
        eq(challenges.isActive, true),
        or(isNull(challenges.startsAt), lte(challenges.startsAt, now))
      )
    );

  const upcoming = await db
    .select()
    .from(challenges)
    .where(
      and(
        eq(challenges.isActive, true),
        sql`${challenges.startsAt} > now()`
      )
    )
    .orderBy(asc(challenges.startsAt));

  const myIds = me
    ? (
        await db
          .select({ id: challengeMembers.challengeId })
          .from(challengeMembers)
          .where(eq(challengeMembers.userId, me.id))
      ).map((r) => r.id)
    : [];

  const activePrograms = await db
    .select()
    .from(programs)
    .where(eq(programs.isActive, true))
    .orderBy(asc(programs.sortOrder));

  const myPrograms = new Map(
    me
      ? (
          await db
            .select({ id: programMembers.programId, currentDay: programMembers.currentDay, completedAt: programMembers.completedAt })
            .from(programMembers)
            .where(eq(programMembers.userId, me.id))
        ).map((r) => [r.id, { currentDay: r.currentDay, completed: !!r.completedAt }])
      : [],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-10 md:py-8">
      <WorkoutsHeader subtitle="Time-bound transformations. Daily unlocks. Real prizes. Real results." />

      {/* ── Programs (e.g. 2-Week Pre-Hoop) ── */}
      {activePrograms.length > 0 && (
        <div className="mb-10">
          <h2 className="mb-3 font-display text-2xl font-bold">Programs</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {activePrograms.map((p) => (
              <ProgramCard key={p.id} program={p} progress={myPrograms.get(p.id) ?? null} />
            ))}
          </div>
        </div>
      )}

      {/* ── Live Challenges ── */}
      {activePrograms.length > 0 && active.length > 0 && (
        <h2 className="mb-4 font-display text-2xl font-bold">Live Challenges</h2>
      )}

      {/* ── Coming Soon ── */}
      {upcoming.length > 0 && (
        <div className={active.length > 0 ? "mt-10" : ""}>
          {active.length > 0 && (
            <h2 className="mb-4 font-display text-2xl font-bold">Coming Soon</h2>
          )}
          <div className="grid gap-6 md:grid-cols-2">
            {upcoming.map((c) => {
              const unlockDate = new Date(c.startsAt!).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
              });
              return (
                <Card key={c.id} className="overflow-hidden">
                  <div
                    className="relative aspect-[16/9] bg-cover bg-center hoop-gradient-bold"
                    style={c.coverUrl ? { backgroundImage: `url('${c.coverUrl}')` } : undefined}
                  >
                    {/* Lock overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 backdrop-blur-[2px] text-white">
                      <Lock className="size-8 opacity-90" />
                      <p className="font-display text-xl font-bold">Coming {unlockDate}</p>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                      <Badge variant="gold">{c.durationDays}-day challenge</Badge>
                      <h2 className="mt-2 font-display text-3xl font-bold">{c.title}</h2>
                      {c.subtitle && <p className="text-sm opacity-90">{c.subtitle}</p>}
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <p className="text-sm text-foreground/80">{c.description}</p>
                    <Button disabled variant="outline" className="mt-4 w-full opacity-60">
                      <Lock className="mr-2 size-4" /> Unlocks {unlockDate}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {active.length === 0 && upcoming.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="mx-auto size-12 text-muted-foreground" />
            <p className="mt-4 font-display text-xl font-bold">No active challenges</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first challenge in the admin panel.
            </p>
          </CardContent>
        </Card>
      ) : active.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {active.map((c) => {
            const joined = myIds.includes(c.id);
            return (
              <Card key={c.id} className="overflow-hidden">
                <div
                  className="relative aspect-[16/9] bg-cover bg-center hoop-gradient-bold"
                  style={c.coverUrl ? { backgroundImage: `url('${c.coverUrl}')` } : undefined}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                    <Badge variant="gold">{c.durationDays}-day challenge</Badge>
                    <h2 className="mt-2 font-display text-3xl font-bold">{c.title}</h2>
                    {c.subtitle && <p className="text-sm opacity-90">{c.subtitle}</p>}
                  </div>
                </div>
                <CardContent className="p-6">
                  <p className="text-sm text-foreground/80">{c.description}</p>
                  <div className="mt-3 rounded-xl bg-primary/5 p-3 text-xs text-foreground/80">
                    <strong>How it works:</strong> One workout per week. Repeat that workout
                    daily for 7 days. Next week's workout unlocks after that. 6 weeks total.
                  </div>
                  {c.rewardDescription && (() => {
                    let prizes: Array<{ amount: number }> | null = null;
                    try { prizes = JSON.parse(c.rewardDescription); } catch {}
                    const total = prizes?.reduce((s, p) => s + p.amount, 0);
                    const label = total ? `$${total.toLocaleString()} in prizes` : c.rewardDescription;
                    return (
                      <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm">
                        <Gift className="size-4 text-amber-600" />
                        <span><strong>Prize pool:</strong> {label}</span>
                      </div>
                    );
                  })()}
                  <Button asChild variant={joined ? "outline" : "gradient"} className="mt-4 w-full">
                    <Link href={`/challenges/${c.slug}`}>
                      {joined ? "View my progress" : "Join challenge"}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
