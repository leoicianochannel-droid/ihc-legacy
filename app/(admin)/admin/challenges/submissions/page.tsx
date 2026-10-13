import { db, challenges, contestEnrollments, contestEntries, users } from "@/lib/db";
import { eq, desc, inArray } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Star, Video, Ruler, ExternalLink, Users } from "lucide-react";

export const dynamic = "force-dynamic";

async function setWinner(enrollmentId: string, category: string) {
  "use server";
  const { userId: clerkId } = await auth();
  if (!clerkId) return;

  const [current] = await db
    .select({ wonCategories: contestEnrollments.wonCategories, challengeId: contestEnrollments.challengeId })
    .from(contestEnrollments)
    .where(eq(contestEnrollments.id, enrollmentId))
    .limit(1);
  if (!current) return;

  const cats = current.wonCategories ?? [];
  const updated = cats.includes(category)
    ? cats.filter((c) => c !== category)          // toggle off
    : [...cats, category];                         // toggle on

  await db
    .update(contestEnrollments)
    .set({ wonCategories: updated })
    .where(eq(contestEnrollments.id, enrollmentId));

  revalidatePath("/admin/challenges/submissions");
}

const PRIZE_CATEGORIES = [
  { key: "reel",           label: "Best Reel, Most Viral",     icon: Video,   prize: 500, auto: true  },
  { key: "inches",         label: "Most Inches Off Waist",     icon: Ruler,   prize: 500, auto: true  },
  { key: "nsv",            label: "Best Non-Scale Victory",    icon: Star,    prize: 500, auto: false },
  { key: "transformation", label: "Best Transformation Story", icon: Trophy,  prize: 500, auto: false },
] as const;

export default async function AdminSubmissionsPage() {
  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.slug, "30-day-challenge"))
    .limit(1);

  if (!challenge) {
    return <div className="container py-8 text-muted-foreground">No challenge found.</div>;
  }

  // Load all enrollments with user info
  const enrollments = await db
    .select({
      id: contestEnrollments.id,
      instagramHandle: contestEnrollments.instagramHandle,
      tiktokHandle: contestEnrollments.tiktokHandle,
      startWaistInches: contestEnrollments.startWaistInches,
      wonCategories: contestEnrollments.wonCategories,
      enrolledAt: contestEnrollments.enrolledAt,
      userId: contestEnrollments.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(contestEnrollments)
    .innerJoin(users, eq(users.id, contestEnrollments.userId))
    .where(eq(contestEnrollments.challengeId, challenge.id))
    .orderBy(desc(contestEnrollments.enrolledAt));

  const enrollmentIds = enrollments.map((e) => e.id);
  const entries = enrollmentIds.length
    ? await db
        .select()
        .from(contestEntries)
        .where(inArray(contestEntries.enrollmentId, enrollmentIds))
    : [];

  // Build a map: enrollmentId → entries[]
  const entriesByEnrollment = new Map<string, typeof entries>();
  for (const entry of entries) {
    if (!entriesByEnrollment.has(entry.enrollmentId)) {
      entriesByEnrollment.set(entry.enrollmentId, []);
    }
    entriesByEnrollment.get(entry.enrollmentId)!.push(entry);
  }

  // For each enrollment compute derived metrics
  const enriched = enrollments.map((enr) => {
    const myEntries = entriesByEnrollment.get(enr.id) ?? [];
    const reels = myEntries.filter((e) => e.entryType === "reel");
    const nsv = myEntries.filter((e) => e.entryType === "nsv");
    const measurements = myEntries.filter((e) => e.entryType === "measurement")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const transformation = myEntries.find((e) => e.entryType === "transformation");

    const topReelViews = Math.max(0, ...reels.map((r) => r.reelViewCount ?? 0));
    const latestMeasurement = measurements.at(-1);
    const inchesLost =
      enr.startWaistInches != null && latestMeasurement?.waistInches != null
        ? enr.startWaistInches - latestMeasurement.waistInches
        : null;

    return {
      ...enr,
      reels,
      nsv,
      measurements,
      transformation,
      topReelViews,
      inchesLost,
    };
  });

  return (
    <div className="container space-y-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Prize Contest</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {challenge.title} · {enrollments.length} enrolled
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" />
          {enrollments.length} contestants
        </div>
      </div>

      {/* One section per prize category */}
      {PRIZE_CATEGORIES.map((cat) => {
        const Icon = cat.icon;

        // Sort & score for this category
        let sorted = [...enriched];
        if (cat.key === "reel") {
          sorted = sorted.filter((e) => e.reels.length > 0).sort((a, b) => b.topReelViews - a.topReelViews);
        } else if (cat.key === "inches") {
          sorted = sorted.filter((e) => e.inchesLost !== null && e.inchesLost > 0).sort((a, b) => (b.inchesLost ?? 0) - (a.inchesLost ?? 0));
        } else if (cat.key === "nsv") {
          sorted = sorted.filter((e) => e.nsv.length > 0);
        } else {
          sorted = sorted.filter((e) => !!e.transformation);
        }

        return (
          <section key={cat.key}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="size-5 text-primary" />
                <h2 className="font-display text-xl font-bold">{cat.label}</h2>
                <Badge variant="outline">{sorted.length} entries</Badge>
                {cat.auto && (
                  <Badge variant="secondary" className="text-xs">Auto-ranked</Badge>
                )}
              </div>
              <span className="font-display text-lg font-bold text-yellow-600 dark:text-yellow-400">$500</span>
            </div>

            {sorted.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No entries yet
              </div>
            ) : (
              <div className="space-y-3">
                {sorted.map((enr, idx) => {
                  const isWinner = (enr.wonCategories ?? []).includes(cat.key);
                  const isTop = idx === 0;

                  return (
                    <div
                      key={enr.id}
                      className={`rounded-xl border bg-card p-4 ${isWinner ? "border-yellow-400/60 ring-1 ring-yellow-400/40 bg-yellow-50/30 dark:bg-yellow-900/10" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Rank badge */}
                        <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${isTop ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                          {idx + 1}
                        </div>

                        {/* Avatar + name */}
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {enr.avatarUrl ? (
                            <img src={enr.avatarUrl} className="size-10 rounded-full object-cover shrink-0" alt="" />
                          ) : (
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                              {(enr.firstName?.[0] ?? "?").toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{enr.firstName} {enr.lastName ?? ""}</span>
                              {isWinner && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400/20 px-2 py-0.5 text-xs font-bold text-yellow-700 dark:text-yellow-300">
                                  🏆 Winner
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{enr.email}</div>
                          </div>
                        </div>

                        {/* Key metric */}
                        <div className="shrink-0 text-right">
                          {cat.key === "reel" && (
                            <div className="font-display text-xl font-bold text-primary">
                              {enr.topReelViews.toLocaleString()}
                              <span className="ml-1 text-xs font-normal text-muted-foreground">views</span>
                            </div>
                          )}
                          {cat.key === "inches" && enr.inchesLost !== null && (
                            <div className="font-display text-xl font-bold text-primary">
                              {enr.inchesLost.toFixed(2)}"
                              <span className="ml-1 text-xs font-normal text-muted-foreground">lost</span>
                            </div>
                          )}
                          {cat.key === "nsv" && (
                            <div className="text-sm text-muted-foreground">
                              {enr.nsv.length} {enr.nsv.length === 1 ? "win" : "wins"} logged
                            </div>
                          )}
                          {cat.key === "transformation" && (
                            <div className="text-xs text-muted-foreground">Story submitted</div>
                          )}
                        </div>
                      </div>

                      {/* Content preview */}
                      <div className="mt-3 space-y-2 pl-11 text-sm">
                        {cat.key === "reel" && enr.reels.map((r) => (
                          <div key={r.id} className="flex items-center gap-2">
                            <a href={r.reelUrl ?? "#"} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
                              {r.reelPlatform ?? "reel"} <ExternalLink className="size-3" />
                            </a>
                            {r.reelViewCount != null && (
                              <span className="text-xs text-muted-foreground">{r.reelViewCount.toLocaleString()} views</span>
                            )}
                          </div>
                        ))}
                        {cat.key === "nsv" && enr.nsv.slice(0, 2).map((n) => (
                          <p key={n.id} className="text-muted-foreground line-clamp-1">• {n.title ?? n.story}</p>
                        ))}
                        {cat.key === "transformation" && enr.transformation && (
                          <>
                            {enr.transformation.title && <p className="font-semibold">{enr.transformation.title}</p>}
                            {enr.transformation.story && (
                              <p className="line-clamp-2 text-muted-foreground">{enr.transformation.story}</p>
                            )}
                            {enr.transformation.photoUrls?.length ? (
                              <div className="flex gap-2">
                                {enr.transformation.photoUrls.map((u) => (
                                  <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                                    <img src={u} className="h-16 w-16 rounded-lg object-cover" alt="" />
                                  </a>
                                ))}
                              </div>
                            ) : null}
                          </>
                        )}
                        {cat.key === "inches" && enr.startWaistInches != null && (
                          <p className="text-muted-foreground">
                            Start: {enr.startWaistInches}" →
                            Latest: {enr.measurements.at(-1)?.waistInches ?? "?"}
                            " ({enr.measurements.length} check-ins)
                          </p>
                        )}
                      </div>

                      {/* Mark winner button */}
                      <div className="mt-3 flex justify-end pl-11">
                        <form action={setWinner.bind(null, enr.id, cat.key)}>
                          <Button type="submit" size="sm" variant={isWinner ? "outline" : "gradient"} className="text-xs">
                            {isWinner ? "Remove winner" : "Mark as winner"}
                          </Button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
