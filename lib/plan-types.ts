/**
 * Type definitions for the personalised 2-month (8-week) member plan.
 * Stored as JSONB in member_plans.plan.
 */

export type PlanWorkoutRef = {
  workoutId: string;
  slug: string;
  title: string;
  durationMin: number | null;
  intensity: string;
  thumbnailUrl: string | null;
};

export type PlanRecipeRef = {
  recipeId: string;
  slug: string;
  title: string;
  mealType: string;
  photoUrl: string | null;
};

export type PlanWeek = {
  week: number;          // 1–8
  theme: string;         // e.g. "Build Your Foundation"
  description: string;   // 1–2 sentence coaching note
  workouts: PlanWorkoutRef[];
  recipes: PlanRecipeRef[];
  challengeSlug: string | null;
  tip: string;           // short motivational tip
};

export type GeneratedPlan = {
  title: string;
  summary: string;       // 2–3 sentence personalised intro
  weeks: PlanWeek[];
};

/** Answers stored from the quiz */
export type QuizAnswers = {
  experience: "never" | "some" | "regular";
  goal: "weight_loss" | "toning" | "cardio" | "stress_relief";
  daysPerWeek: 2 | 3 | 4 | 5 | 6 | 7;
  minutesPerSession: 20 | 30 | 45 | 60;
  physicalNotes: string;
  dietaryPreference: string;
};
