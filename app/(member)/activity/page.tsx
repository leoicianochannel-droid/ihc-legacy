import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Dumbbell, Trash2 } from "lucide-react";
import { LogWorkoutForm } from "./log-workout-form";
import { getWorkoutHistory, deletePersonalWorkout } from "./actions";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ACTIVITY_LABELS: Record<string, string> = {
  hooping: "🪀 Hooping",
  restyling: "✨ Restyling",
  walking: "🚶 Walking",
  dance: "💃 Dance",
  yoga: "🧘 Yoga / Stretch",
  gym: "🏋️ Gym",
  other: "⚡ Other",
};

export default async function ActivityPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const [me] = await db.select({ id: users.id, firstName: users.firstName }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) redirect("/onboarding");

  const history = await getWorkoutHistory(me.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-8 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Log a Workout</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track any workout — hooping while watching TV, a gym session, a walk. Every move counts toward your streak.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <LogWorkoutForm />
        </CardContent>
      </Card>

      {history.length > 0 && (
        <div>
          <h2 className="mb-3 font-semibold text-muted-foreground text-sm uppercase tracking-wide">Recent activity</h2>
          <div className="space-y-2">
            {history.map((w) => (
              <div
                key={w.id}
                className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3"
              >
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-base">
                  {ACTIVITY_LABELS[w.activityType]?.split(" ")[0] ?? "⚡"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm leading-tight">
                    {ACTIVITY_LABELS[w.activityType] ?? w.activityType}
                    {w.title ? ` — ${w.title}` : ""}
                  </p>
                  {w.notes && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{w.notes}</p>
                  )}
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {w.durationMin} min
                    </span>
                    <span>{formatDate(w.loggedAt)}</span>
                  </div>
                </div>
                <form action={deletePersonalWorkout.bind(null, w.id)}>
                  <button
                    type="submit"
                    title="Delete this entry"
                    className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length === 0 && (
        <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center">
          <Dumbbell className="mx-auto mb-2 size-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">No workouts logged yet</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Log your first one above — every session counts!</p>
        </div>
      )}
    </div>
  );
}
