/**
 * Automatic workout unlock rules based on intensity.
 * Beginner = always available; Intermediate = Day 30; Advanced = Day 60.
 *
 * An explicit `unlocksAtDay` on a workout overrides the rule:
 *   - 0  = always free (force-unlock an otherwise-locked video)
 *   - N  = lock until Day N regardless of intensity
 *   - null = fall back to the intensity rule (the default)
 */
export const INTENSITY_UNLOCK_DAYS: Record<string, number | null> = {
  beginner: null,
  intermediate: 30,
  advanced: 60,
};

/** All day thresholds at which workouts automatically unlock. */
export const WORKOUT_UNLOCK_DAYS = [30, 60] as const;

export function getEffectiveUnlockDay(w: {
  intensity: string;
  unlocksAtDay: number | null;
}): number | null {
  if (w.unlocksAtDay !== null) {
    return w.unlocksAtDay === 0 ? null : w.unlocksAtDay;
  }
  return INTENSITY_UNLOCK_DAYS[w.intensity] ?? null;
}
