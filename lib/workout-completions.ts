export type WorkoutCompletion =
  | { type: "discount-code"; code: string; label: string }
  | { type: "challenge-funnel"; challengeSlugs: string[] };

// Keys must match the workout `slug` field in the DB.
// Update slugs here if you name the videos differently when uploading.
export const WORKOUT_COMPLETIONS: Record<string, WorkoutCompletion> = {
  "autumn-reset": {
    type: "discount-code",
    code: "AUTUMN20",
    label: "20% off your next order",
  },
  "flow-workout": {
    type: "challenge-funnel",
    challengeSlugs: ["21-day-reset", "75-hard"],
  },
};
