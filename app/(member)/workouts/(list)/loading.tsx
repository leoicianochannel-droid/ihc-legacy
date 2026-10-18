import { WorkoutsHeader, WorkoutsSkeleton } from "@/components/member/workouts-section";

// Lives in the (list) route group so it only covers /workouts itself,
// not individual workout pages.
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-10 md:py-8">
      <WorkoutsHeader as="p" subtitle="Pick your length, intensity, or body focus." />
      <WorkoutsSkeleton />
    </div>
  );
}
