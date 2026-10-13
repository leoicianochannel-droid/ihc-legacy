import { db, challenges, challengeDays, workouts } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { saveChallengeAllDays, updateChallengeStartsAt, uploadChallengeCover } from "./actions";
import { ArrowLeft, Calendar, ImageIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ChallengeDaysPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.slug, slug))
    .limit(1);
  if (!challenge) notFound();

  const [days, allWorkouts] = await Promise.all([
    db
      .select()
      .from(challengeDays)
      .where(eq(challengeDays.challengeId, challenge.id))
      .orderBy(asc(challengeDays.dayNumber)),
    db
      .select({
        id: workouts.id,
        title: workouts.title,
        durationMin: workouts.durationMin,
        intensity: workouts.intensity,
        muxPlaybackId: workouts.muxPlaybackId,
      })
      .from(workouts)
      .orderBy(asc(workouts.title)),
  ]);

  const readyWorkouts = allWorkouts.filter((w) => w.muxPlaybackId);
  const startsAtValue = challenge.startsAt
    ? new Date(challenge.startsAt).toISOString().slice(0, 10)
    : "";

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/content" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold">{challenge.title}</h1>
          <p className="text-sm text-muted-foreground">{challenge.durationDays}-day challenge · assign a workout to each day</p>
        </div>
      </div>

      {/* Cover image */}
      <Card>
        <CardContent className="p-4">
          <form action={uploadChallengeCover.bind(null, slug)} encType="multipart/form-data" className="space-y-3">
            <label className="flex items-center gap-1.5 text-sm font-medium">
              <ImageIcon className="size-3.5" /> Cover image
            </label>
            {challenge.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={challenge.coverUrl} alt="Challenge cover" className="h-32 w-full rounded-xl object-cover" />
            )}
            <div className="flex flex-wrap items-center gap-3">
              <input
                name="cover"
                type="file"
                accept="image/*"
                required
                className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground"
              />
              <Button type="submit" variant="outline" size="sm">Upload</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Publish date control */}
      <Card>
        <CardContent className="p-4">
          <form action={updateChallengeStartsAt.bind(null, slug)} className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-sm font-medium">
                <Calendar className="size-3.5" /> Publish date
              </label>
              <input
                name="startsAt"
                type="date"
                defaultValue={startsAtValue}
                className="h-9 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-[11px] text-muted-foreground">
                Hidden from members until this date. Clear to publish immediately.
              </p>
            </div>
            <Button type="submit" variant="outline" size="sm">Save date</Button>
            <div className="ml-auto text-right text-sm">
              <span className={`font-medium ${challenge.isActive ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                {challenge.isActive ? "Active" : "Inactive"}
              </span>
              {challenge.startsAt && new Date(challenge.startsAt) > new Date() && (
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  Publishes {new Date(challenge.startsAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Day assignment form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Day assignments
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {readyWorkouts.length} videos ready · {days.filter((d) => d.workoutId).length}/{days.length} days assigned
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <form action={saveChallengeAllDays}>
            <input type="hidden" name="challengeId" value={challenge.id} />
            <div className="divide-y">
              {days.map((day) => (
                <div key={day.id} className="flex items-center gap-4 px-4 py-3">
                  <span className="w-14 shrink-0 text-sm font-semibold text-muted-foreground">
                    Day {day.dayNumber}
                  </span>
                  <select
                    name={`day-${day.dayNumber}`}
                    defaultValue={day.workoutId ?? ""}
                    className="flex-1 h-9 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">— no workout —</option>
                    {readyWorkouts.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.title} ({w.durationMin}m · {w.intensity})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="border-t p-4">
              <Button type="submit" variant="gradient">Save all days</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
