import { WorkoutsSkeleton } from "@/components/member/workouts-section";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-6 md:px-10">
      <WorkoutsSkeleton cards={2} />
    </div>
  );
}
