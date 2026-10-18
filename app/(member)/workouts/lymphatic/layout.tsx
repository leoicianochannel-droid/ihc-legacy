import { WorkoutsHeader } from "@/components/member/workouts-section";

// Keeps the Workouts title + section tabs on screen for this section, so
// switching tabs feels like one screen instead of leaving Workouts.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-6 md:px-10 md:pt-8">
        <WorkoutsHeader as="p" />
      </div>
      {children}
    </>
  );
}
