/**
 * Seeds the "2 Week Pre-Hoop" program — 14 days with multiple exercises each.
 * Maps each exercise to one of the 40 already-uploaded Pre-Hoop workout videos.
 *
 * Re-runs are safe: clears + recreates the program (but keeps any member progress
 * via member tables since those reference programId, not the day rows specifically).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import {
  db,
  programs,
  programDays,
  programDayExercises,
  workouts,
} from "@/lib/db";
import { eq } from "drizzle-orm";

// Map of exercise label → workout title (we look up the cfStreamUid by title).
type Day = {
  number: number;
  title: string;
  description?: string;
  isRest?: boolean;
  exercises: Array<{ label: string; reps?: string; matchTitle?: string }>;
};

const DAYS: Day[] = [
  {
    number: 1,
    title: "Core Activation",
    exercises: [
      { label: "Plank",            reps: "30 sec x3",      matchTitle: "Forearm Plank" },
      { label: "Glute Bridges",    reps: "15 reps",        matchTitle: "Glute Bridges" },
      { label: "Crunches",         reps: "20 reps",        matchTitle: "Crunches" },
      { label: "Bird Dogs",        reps: "10 each side",   matchTitle: "Bird Dogs" },
    ],
  },
  {
    number: 2,
    title: "Cardio & Lower Body",
    exercises: [
      { label: "Bodyweight Squats",  reps: "20",           matchTitle: "Bodyweight Squats" },
      { label: "Alternating Lunges", reps: "20 total",     matchTitle: "Forward Alternating Lunges" },
      { label: "Jumping Jacks",      reps: "30 sec x3",    matchTitle: "Jumping Jacks" },
      { label: "Calf Raises",        reps: "10",           matchTitle: "Calf Raises" },
    ],
  },
  {
    number: 3,
    title: "Active Rest",
    isRest: true,
    description: "Easy day — focus on recovery.",
    exercises: [
      { label: "20–30 min walk",                           matchTitle: "Gentle Walk" },
      { label: "5 min light stretch (hips & back)",        matchTitle: "Cat Cow Stretch" },
    ],
  },
  {
    number: 4,
    title: "Core & Balance",
    exercises: [
      { label: "Russian Twists",         reps: "20",           matchTitle: "Russian Twists" },
      { label: "Leg Raises",             reps: "15",           matchTitle: "Leg Lifts" },
      { label: "Side Planks",            reps: "30 sec each",  matchTitle: "Side Plank" },
      { label: "Standing Knee-to-Elbow", reps: "10 each side", matchTitle: "Standing Knee To Elbows" },
    ],
  },
  {
    number: 5,
    title: "Full Body Burn",
    exercises: [
      { label: "Squats + Shoulder Press", reps: "10",        matchTitle: "Squat + Shoulder Press" },
      { label: "Push-ups",                reps: "10 (knees or full)", matchTitle: "Push Ups" },
      { label: "Slow High Knees",         reps: "15",        matchTitle: "Slow High Knees" },
      { label: "Jumping Jacks",           reps: "10",        matchTitle: "Jumping Jacks" },
    ],
  },
  {
    number: 6,
    title: "Mobility & Stretch",
    exercises: [
      { label: "Hip Circles",         reps: "10 each direction", matchTitle: "Hip Circles" },
      { label: "Cat-Cow Stretch",                                 matchTitle: "Cat Cow Stretch" },
      { label: "Seated Spinal Twist",                             matchTitle: "Seated Spinal Twist" },
      { label: "Hamstring Stretch",                               matchTitle: "Hamstring Stretch" },
    ],
  },
  {
    number: 7,
    title: "Rest / Gentle Walk",
    isRest: true,
    description: "Total rest, or a light walk if you feel like moving.",
    exercises: [
      { label: "Gentle 20-min walk (optional)",            matchTitle: "Gentle Walk" },
    ],
  },
  {
    number: 8,
    title: "Core + Glutes",
    exercises: [
      { label: "Plank",            reps: "30 sec x3",     matchTitle: "Forearm Plank" },
      { label: "Glute Bridges",    reps: "20",            matchTitle: "Glute Bridges" },
      { label: "Bicycle Crunches", reps: "15",            matchTitle: "Bicycles" },
      { label: "Donkey Kicks",     reps: "10 each leg",   matchTitle: "Donkey Kicks" },
    ],
  },
  {
    number: 9,
    title: "Cardio HIIT (Low Impact)",
    exercises: [
      { label: "Step-Taps",       reps: "20",            matchTitle: "Step Taps" },
      { label: "Knee Drives",     reps: "15 each side",  matchTitle: "Knee Drives" },
      { label: "March in Place",  reps: "30 sec x3",     matchTitle: "March In Place" },
      { label: "Squats",          reps: "15",            matchTitle: "Bodyweight Squats" },
    ],
  },
  {
    number: 10,
    title: "Active Recovery",
    isRest: true,
    description: "Move gently — your body is rebuilding.",
    exercises: [
      { label: "20–30 min walk or dance",                  matchTitle: "Gentle Walk" },
      { label: "Stretch hips, lower back, shoulders",      matchTitle: "Wide Legged Forward Fold" },
    ],
  },
  {
    number: 11,
    title: "Core Stability",
    exercises: [
      { label: "Dead Bug Hold",   reps: "10",            matchTitle: "Dead Bug Hold" },
      { label: "Seated Twists",   reps: "15",            matchTitle: "Seated Twists" },
      { label: "Side Leg Lifts",  reps: "10 each side",  matchTitle: "Side Leg Lifts" },
      { label: "Forearm Plank",   reps: "20 sec x3",     matchTitle: "Forearm Plank" },
    ],
  },
  {
    number: 12,
    title: "Legs & Cardio",
    exercises: [
      { label: "Lunges",            reps: "15 each leg", matchTitle: "Forward Alternating Lunges" },
      { label: "Jumping Jacks",     reps: "20",          matchTitle: "Jumping Jacks" },
      { label: "Squats to Toe Raise", reps: "10",        matchTitle: "Squat To Toe Raises" },
      { label: "Fast Feet",         reps: "30 sec x2",   matchTitle: "Fast Feet" },
    ],
  },
  {
    number: 13,
    title: "Yoga Flow / Stretch",
    exercises: [
      { label: "Sun Salutation",                                matchTitle: "Sun Salutations" },
      { label: "Hip Openers",                                   matchTitle: "Hip Openers" },
      { label: "Deep Breathing",   reps: "10–15 min total",     matchTitle: "Deep Breathing" },
    ],
  },
  {
    number: 14,
    title: "Rest Day",
    isRest: true,
    description: "You earned it. Take the day fully off — no movement required. Tomorrow you start the hoop.",
    exercises: [],
  },
];

async function main() {
  // Find or create the program
  const SLUG = "2-week-pre-hoop";
  const allWorkouts = await db.select().from(workouts);
  const byTitle = new Map(allWorkouts.map((w) => [w.title.toLowerCase(), w]));

  let [program] = await db.select().from(programs).where(eq(programs.slug, SLUG)).limit(1);
  if (!program) {
    [program] = await db
      .insert(programs)
      .values({
        slug: SLUG,
        title: "2 Week Pre-Hoop",
        subtitle: "Build the foundation",
        description:
          "14 days of bodyweight movement to prepare your core, hips, and stamina for the hoop. Each day takes 15-25 minutes. Do them in order — they build on each other.",
        durationDays: 14,
        isActive: true,
        sortOrder: 0,
      })
      .returning();
  } else {
    // Wipe existing days so re-runs are clean
    await db.delete(programDays).where(eq(programDays.programId, program.id));
  }

  let unmatched: string[] = [];
  let exerciseCount = 0;

  for (const day of DAYS) {
    const [pd] = await db
      .insert(programDays)
      .values({
        programId: program.id,
        dayNumber: day.number,
        title: day.title,
        description: day.description ?? null,
        isRestDay: day.isRest ?? false,
      })
      .returning();

    for (const [i, ex] of day.exercises.entries()) {
      let workoutId: string | null = null;
      if (ex.matchTitle) {
        const w = byTitle.get(ex.matchTitle.toLowerCase());
        if (w) workoutId = w.id;
        else unmatched.push(`Day ${day.number}: "${ex.label}" → "${ex.matchTitle}"`);
      }
      await db.insert(programDayExercises).values({
        programDayId: pd.id,
        workoutId,
        label: ex.label,
        repsLabel: ex.reps ?? null,
        sortOrder: i,
      });
      exerciseCount++;
    }
  }

  console.log(`✅ Seeded program "${program.title}"`);
  console.log(`   ${DAYS.length} days, ${exerciseCount} exercises`);
  if (unmatched.length) {
    console.log(`\n⚠️  ${unmatched.length} exercises couldn't find a matching video:`);
    for (const u of unmatched) console.log(`   ${u}`);
  } else {
    console.log("   All exercises matched a video ✓");
  }
}

main().catch(console.error).finally(() => process.exit(0));
