import Link from "next/link";
import { ChevronRight, ListChecks } from "lucide-react";
import { noDashes } from "@/lib/utils";

/** Compact program tile used on Challenges and Programs. */
export function ProgramCard({
  program,
  progress,
}: {
  program: { slug: string; title: string; subtitle: string | null; description: string | null; durationDays: number };
  /** null when the member hasn't started it */
  progress: { currentDay: number; completed: boolean } | null;
}) {
  const cta = !progress ? "Start" : progress.completed ? "Review" : `Day ${progress.currentDay}`;
  return (
    <Link
      href={`/programs/${program.slug}`}
      className="flex items-center gap-4 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40 active:bg-muted/50"
    >
      <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <span className="font-display text-xl font-bold leading-none">{program.durationDays}</span>
        <span className="text-[10px] font-semibold uppercase opacity-90">days</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug">{program.title}</span>
        <span className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
          {program.subtitle ?? (program.description ? noDashes(program.description) : "")}
        </span>
        {progress && !progress.completed && (
          <span className="mt-2 block h-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${Math.round(((progress.currentDay - 1) / program.durationDays) * 100)}%` }}
            />
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primary">
        {progress?.completed ? <ListChecks className="size-4" /> : null}
        {cta}
        <ChevronRight className="size-4" />
      </span>
    </Link>
  );
}
