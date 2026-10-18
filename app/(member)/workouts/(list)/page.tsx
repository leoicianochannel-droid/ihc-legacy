import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db, workouts, users, activityLog } from "@/lib/db";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayCircle, Lock } from "lucide-react";
import { WorkoutsHeader } from "@/components/member/workouts-section";
import { ChipRow } from "@/components/member/chip-row";
import { cn } from "@/lib/utils";
import { getEffectiveUnlockDay } from "@/lib/workout-access";

export const dynamic = "force-dynamic";

const INTENSITIES = ["beginner", "intermediate", "advanced"] as const;
type Intensity = (typeof INTENSITIES)[number];

async function ensureUnlocksAtDayColumn() {
  try {
    await db.execute(sql`ALTER TABLE workouts ADD COLUMN IF NOT EXISTS unlocks_at_day integer`);
  } catch {
    // column already exists — no-op
  }
}

export default async function WorkoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ intensity?: string }>;
}) {
  await ensureUnlocksAtDayColumn();

  const { intensity: rawIntensity } = await searchParams;
  const activeIntensity: Intensity | null = INTENSITIES.includes(rawIntensity as Intensity)
    ? (rawIntensity as Intensity)
    : null;

  const filters = [eq(workouts.challengeOnly, false)];
  if (activeIntensity) filters.push(eq(workouts.intensity, activeIntensity));

  // Fetch workouts and auth in parallel
  const [list, { userId: clerkId }] = await Promise.all([
    db.select().from(workouts).where(and(...filters)).orderBy(desc(workouts.publishedAt)),
    auth(),
  ]);

  // Determine member's day count and which workouts they've already done
  let memberDays = 0;
  const completedWorkoutIds = new Set<string>();

  if (clerkId) {
    const [me] = await db
      .select({ id: users.id, onboardedAt: users.onboardedAt, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (me) {
      const start = me.onboardedAt ?? me.createdAt;
      memberDays = Math.floor((Date.now() - new Date(start).getTime()) / (1000 * 60 * 60 * 24));

      const completions = await db
        .select({ referenceId: activityLog.referenceId })
        .from(activityLog)
        .where(
          and(
            eq(activityLog.userId, me.id),
            eq(activityLog.type, "workout_completed"),
            isNotNull(activityLog.referenceId)
          )
        );
      for (const c of completions) {
        if (c.referenceId) completedWorkoutIds.add(c.referenceId);
      }
    }
  }

  const groups = new Map<string, typeof list>();
  const ORDER: string[] = [];
  for (const w of list) {
    const key = w.collection ?? "Standalone Sessions";
    if (!groups.has(key)) { groups.set(key, []); ORDER.push(key); }
    groups.get(key)!.push(w);
  }
  ORDER.sort((a, b) => (a === "Standalone Sessions" ? -1 : b === "Standalone Sessions" ? 1 : 0));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-10 md:py-8">
      <WorkoutsHeader subtitle="Pick your length, intensity, or body focus." />

      <ChipRow
        label="Difficulty"
        className="mb-8"
        options={[
          { key: "all", label: "All", href: "/workouts", active: activeIntensity === null },
          ...INTENSITIES.map((i) => ({
            key: i,
            label: i[0].toUpperCase() + i.slice(1),
            href: `/workouts?intensity=${i}`,
            active: activeIntensity === i,
          })),
        ]}
      />

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <PlayCircle className="mx-auto size-12 text-muted-foreground" />
            <p className="mt-4 font-display text-xl font-bold">No workouts yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {ORDER.map((key) => {
            const items = groups.get(key)!;
            return (
              <section key={key}>
                <div className="mb-4 flex items-end justify-between">
                  <h2 className="font-display text-2xl font-bold">{key}</h2>
                  <span className="text-sm text-muted-foreground">{items.length} workout{items.length === 1 ? "" : "s"}</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((w) => {
                    const effectiveUnlockDay = getEffectiveUnlockDay(w);
                    const isLocked =
                      effectiveUnlockDay !== null &&
                      memberDays < effectiveUnlockDay &&
                      !completedWorkoutIds.has(w.id);

                    const thumbnail = (
                      <img
                        src={w.thumbnailUrl ?? `/api/workout-cover/${w.slug}`}
                        alt={w.title}
                        className={cn("size-full object-cover transition-transform", !isLocked && "group-hover:scale-105", isLocked && "scale-105 blur-sm")}
                      />
                    );

                    const cardBody = (
                      <>
                        <div className="relative aspect-video overflow-hidden bg-muted">
                          {thumbnail}
                          {isLocked && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50">
                              <Lock className="size-7 text-foreground/70" />
                              <span className="mt-1.5 rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-bold text-foreground/80">
                                Unlocks Day {effectiveUnlockDay}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className={cn("flex flex-1 flex-col p-4", isLocked && "opacity-50")}>
                          <div className="mb-1 flex items-center gap-1.5">
                            <Badge className="capitalize text-[10px]">{w.intensity}</Badge>
                            <span className="text-xs text-muted-foreground">{w.durationMin} min</span>
                            {w.caloriesBurnedEst && (
                              <span className="text-xs text-muted-foreground">· ~{w.caloriesBurnedEst} cal</span>
                            )}
                          </div>
                          <h3 className="font-display text-lg font-bold leading-tight">{w.title}</h3>
                          {w.instructor && (
                            <p className="mt-0.5 text-xs text-muted-foreground">with {w.instructor}</p>
                          )}
                          {w.description && (
                            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{w.description}</p>
                          )}
                          {(w.bodyFocus.length > 0 || w.equipment.length > 0) && (
                            <div className="mt-3 flex flex-wrap gap-1">
                              {w.bodyFocus.map((f) => (
                                <Badge key={f} variant="secondary" className="text-[10px] uppercase">{f}</Badge>
                              ))}
                              {w.equipment.map((e) => (
                                <Badge key={e} variant="outline" className="text-[10px] uppercase">{e}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    );

                    return isLocked ? (
                      <div key={w.id} className="block overflow-hidden rounded-2xl border bg-card shadow-sm cursor-default select-none">
                        {cardBody}
                      </div>
                    ) : (
                      <Link key={w.id} href={`/workouts/${w.slug}`}
                        className="group block overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md"
                      >
                        {cardBody}
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
