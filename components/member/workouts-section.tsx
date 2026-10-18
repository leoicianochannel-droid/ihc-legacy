import { WorkoutTabs } from "@/components/member/workout-tabs";

/** Large "Workouts" title + section tabs, shared by every Workouts section. */
export function WorkoutsHeader({ subtitle, as: Title = "h1" }: { subtitle?: string; as?: "h1" | "p" }) {
  return (
    <div className="mb-6">
      <Title className="font-display text-4xl font-bold">Workouts</Title>
      <WorkoutTabs className="mt-4" />
      {/* Subtitle sits under the tabs so the tabs stay put across sections */}
      {subtitle && <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

/** Placeholder cards shown the instant a Workouts tab is tapped. */
export function WorkoutsSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="grid animate-pulse gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border bg-card">
          <div className="aspect-[16/9] bg-muted" />
          <div className="space-y-3 p-5">
            <div className="h-4 w-24 rounded-full bg-muted" />
            <div className="h-5 w-3/4 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
