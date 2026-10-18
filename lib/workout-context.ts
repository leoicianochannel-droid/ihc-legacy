/**
 * Where a workout was opened from. When a member taps "Watch" on a challenge
 * or program day, the workout URL carries that day along
 * (/workouts/plank?program=pre-hoop&day=3) so finishing the video can tick
 * off that exact day and send them back to it.
 */
export type WorkoutContext = { kind: "challenge" | "program"; slug: string; day: number };

/** Workout link that remembers which challenge/program day it came from. */
export function workoutHref(workoutSlug: string, ctx?: WorkoutContext | null): string {
  const base = `/workouts/${workoutSlug}`;
  if (!ctx) return base;
  return `${base}?${ctx.kind}=${encodeURIComponent(ctx.slug)}&day=${ctx.day}`;
}

/** Read the context back off a workout page's search params. */
export function parseWorkoutContext(sp: {
  challenge?: string;
  program?: string;
  day?: string;
}): WorkoutContext | null {
  const day = Number(sp.day);
  if (!Number.isInteger(day) || day < 1) return null;
  if (sp.challenge) return { kind: "challenge", slug: sp.challenge, day };
  if (sp.program) return { kind: "program", slug: sp.program, day };
  return null;
}

/** The challenge/program page, scrolled to (and opening) that day. */
export function contextHref(ctx: WorkoutContext): string {
  return ctx.kind === "challenge"
    ? `/challenges/${ctx.slug}?day=${ctx.day}#day-${ctx.day}`
    : `/programs/${ctx.slug}?day=${ctx.day}#day-${ctx.day}`;
}
