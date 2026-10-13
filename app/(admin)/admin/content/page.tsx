import { db, workouts, recipes, challenges } from "@/lib/db";
import { FileText, Lock } from "lucide-react";
import { desc } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { DeleteButton } from "./delete-button";
import { WorkoutUnlockSelect } from "./workout-unlock-select";
import { toggleChallengeOnly } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminContent() {
  const w = await db.select().from(workouts).orderBy(desc(workouts.createdAt)).limit(50);
  const r = await db.select().from(recipes).orderBy(desc(recipes.createdAt)).limit(50);
  const c = await db.select().from(challenges).orderBy(desc(challenges.createdAt));

  return (
    <div className="container space-y-8 py-8">
      <h1 className="font-display text-3xl font-bold">Content</h1>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">Workouts ({w.length})</h2>
          <Button asChild variant="gradient">
            <Link href="/admin/content/workouts/new">+ New workout</Link>
          </Button>
        </div>
        <Card className="mt-3">
          <CardContent className="p-0">
            {w.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No workouts yet.</div>
            ) : (
              <ul className="divide-y">
                {w.map((x) => {
                  const status =
                    !x.muxAssetId
                      ? "No video"
                      : !x.muxPlaybackId
                      ? "Processing…"
                      : "Ready";
                  return (
                    <li key={x.id} className="flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold">{x.title}</span>
                          {x.unlocksAtDay !== null && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                              <Lock className="size-2.5" /> Day {x.unlocksAtDay}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {x.durationMin}m · <span className="capitalize">{x.intensity}</span> · {status} · {formatDate(x.createdAt)}
                        </div>
                      </div>
                      <form action={toggleChallengeOnly.bind(null, x.id, !x.challengeOnly)}>
                        <button
                          type="submit"
                          title={x.challengeOnly ? "Move to library (currently challenge-only)" : "Move to challenge-only"}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors ${
                            x.challengeOnly
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                              : "bg-muted text-muted-foreground hover:bg-purple-100 hover:text-purple-700"
                          }`}
                        >
                          {x.challengeOnly ? "Challenge only" : "Library"}
                        </button>
                      </form>
                      <WorkoutUnlockSelect workoutId={x.id} current={x.unlocksAtDay ?? null} />
                      <Button asChild variant="ghost" size="sm" title="Edit transcript">
                        <Link href={`/admin/content/workouts/${x.id}/transcript`}>
                          <FileText className="size-4" />
                          {x.transcript && Array.isArray(x.transcript) && (x.transcript as unknown[]).length > 0
                            ? <span className="text-xs text-primary">✓</span>
                            : null}
                        </Link>
                      </Button>
                      <DeleteButton kind="workout" id={x.id} title={x.title} />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">Recipes ({r.length})</h2>
          <Button asChild variant="gradient">
            <Link href="/admin/content/recipes/new">+ New recipe</Link>
          </Button>
        </div>
        <Card className="mt-3">
          <CardContent className="p-0">
            {r.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No recipes yet.</div>
            ) : (
              <ul className="divide-y">
                {r.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-semibold">{x.title}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {x.mealType} · {x.timeMin}m · {x.calories} cal · {formatDate(x.createdAt)}
                      </div>
                    </div>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/admin/content/recipes/${x.id}/edit`}>Edit</Link>
                    </Button>
                    <DeleteButton kind="recipe" id={x.id} title={x.title} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">Challenges ({c.length})</h2>
          <Button asChild variant="gradient">
            <Link href="/admin/content/challenges/new">+ New challenge</Link>
          </Button>
        </div>
        <Card className="mt-3">
          <CardContent className="p-0">
            {c.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No challenges yet.</div>
            ) : (
              <ul className="divide-y">
                {c.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-semibold">{x.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {x.durationDays}-day · {x.isActive ? "Active" : "Inactive"}
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/content/challenges/${x.slug}/resources`}>
                        Cheat sheets
                      </Link>
                    </Button>
                    <DeleteButton kind="challenge" id={x.id} title={x.title} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
