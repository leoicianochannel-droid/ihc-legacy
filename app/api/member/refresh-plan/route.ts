import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  db, users, workouts, recipes, challenges,
  planQuestionnaires, memberPlans,
} from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import type { GeneratedPlan, PlanWeek, PlanWorkoutRef, PlanRecipeRef, QuizAnswers } from "@/lib/plan-types";

export const maxDuration = 60;

export async function POST() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [me] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  // Look up existing plan + questionnaire
  const [planRow] = await db
    .select()
    .from(memberPlans)
    .where(eq(memberPlans.userId, me.id))
    .limit(1);
  if (!planRow) return NextResponse.json({ error: "no_plan" }, { status: 404 });

  const [questionnaire] = planRow.questionnaireId
    ? await db
        .select()
        .from(planQuestionnaires)
        .where(eq(planQuestionnaires.id, planRow.questionnaireId))
        .limit(1)
    : [];
  if (!questionnaire) return NextResponse.json({ error: "no_questionnaire" }, { status: 404 });

  const answers: QuizAnswers = {
    experience: questionnaire.experience as QuizAnswers["experience"],
    goal: questionnaire.goal as QuizAnswers["goal"],
    daysPerWeek: questionnaire.daysPerWeek as QuizAnswers["daysPerWeek"],
    minutesPerSession: questionnaire.minutesPerSession as QuizAnswers["minutesPerSession"],
    physicalNotes: questionnaire.physicalNotes ?? "none",
    dietaryPreference: questionnaire.dietaryPreference ?? "none",
  };

  // Fetch available content
  const allWorkouts = await db
    .select({
      id: workouts.id,
      slug: workouts.slug,
      title: workouts.title,
      intensity: workouts.intensity,
      durationMin: workouts.durationMin,
      bodyFocus: workouts.bodyFocus,
      thumbnailUrl: workouts.thumbnailUrl,
      challengeOnly: workouts.challengeOnly,
    })
    .from(workouts)
    .where(eq(workouts.challengeOnly, false))
    .orderBy(desc(workouts.publishedAt))
    .limit(60);

  const allRecipes = await db
    .select({
      id: recipes.id,
      slug: recipes.slug,
      title: recipes.title,
      mealType: recipes.mealType,
      dietaryTags: recipes.dietaryTags,
      photoUrl: recipes.photoUrl,
    })
    .from(recipes)
    .limit(40);

  const allChallenges = await db
    .select({ id: challenges.id, slug: challenges.slug, title: challenges.title })
    .from(challenges)
    .where(eq(challenges.isActive, true));

  // Build Claude prompt (same as generate-plan)
  const workoutSummary = allWorkouts
    .map((w) => `ID:${w.id} slug:${w.slug} "${w.title}" intensity:${w.intensity} ${w.durationMin ?? "?"}min focus:[${w.bodyFocus.join(",")}]`)
    .join("\n");
  const recipeSummary = allRecipes
    .map((r) => `ID:${r.id} slug:${r.slug} "${r.title}" meal:${r.mealType} tags:[${r.dietaryTags.join(",")}]`)
    .join("\n");
  const challengeSummary = allChallenges.map((c) => `slug:${c.slug} "${c.title}"`).join("\n");

  const goalLabels: Record<string, string> = {
    weight_loss: "lose weight and burn fat",
    toning: "tone up and build strength",
    cardio: "improve cardio fitness and endurance",
    stress_relief: "reduce stress and have fun",
  };
  const experienceLabels: Record<string, string> = {
    never: "complete beginner — never tried hooping",
    some: "some experience with hooping",
    regular: "regular hooper looking to level up",
  };

  const prompt = `You are a fitness coach for Infinity Hoop, a weighted hoop fitness community. Create a personalised 8-week plan for this member.

MEMBER PROFILE:
- Experience: ${experienceLabels[answers.experience] ?? answers.experience}
- Goal: ${goalLabels[answers.goal] ?? answers.goal}
- Available days per week: ${answers.daysPerWeek}
- Minutes per session: ${answers.minutesPerSession}
- Physical notes: ${answers.physicalNotes === "none" ? "none" : answers.physicalNotes}
- Dietary preference: ${answers.dietaryPreference}

AVAILABLE WORKOUTS (use exact IDs and slugs):
${workoutSummary || "No workouts yet — use empty arrays for workouts."}

AVAILABLE RECIPES (use exact IDs and slugs):
${recipeSummary || "No recipes yet — use empty arrays for recipes."}

AVAILABLE CHALLENGES:
${challengeSummary || "None active."}

INSTRUCTIONS:
1. Create exactly 8 weeks. Weeks 1–2 = Foundation, Weeks 3–4 = Building, Weeks 5–6 = Momentum, Weeks 7–8 = Peak.
2. Assign ${answers.daysPerWeek} workouts per week. Match intensity to experience: beginners start with beginner-only workouts; advanced members get intermediate/advanced.
3. Prefer workouts under ${answers.minutesPerSession} minutes.
4. Assign 2–3 recipes per week filtered by dietary preference (${answers.dietaryPreference}).
5. If a challenge exists, assign it starting in week 3 or 4 (once foundation is built).
6. CRITICAL: Each week must have a DIFFERENT set of workouts. Never assign the same workout to two consecutive weeks. Spread workouts so members experience variety — repeating a workout is only acceptable after a gap of at least 3 weeks. The most common mistake is assigning the same 5 workouts to every week — DO NOT do this.
7. Copy style for title, summary, theme, description and tip: short, warm, plain English, like a pro copywriter. Never use em dashes or en dashes.
8. Return ONLY valid JSON — no markdown, no explanation, no code fences.

Return this exact JSON shape:
{
  "title": "string — personalised plan title",
  "summary": "string — 2–3 sentences personalised to their goal and experience",
  "weeks": [
    {
      "week": 1,
      "theme": "string — short theme name",
      "description": "string — 1–2 sentence coaching note for this week",
      "workouts": [
        { "workoutId": "uuid", "slug": "string", "title": "string", "durationMin": number_or_null, "intensity": "string", "thumbnailUrl": "string_or_null" }
      ],
      "recipes": [
        { "recipeId": "uuid", "slug": "string", "title": "string", "mealType": "string", "photoUrl": "string_or_null" }
      ],
      "challengeSlug": "string or null",
      "tip": "string — one sentence motivational tip"
    }
  ]
}`;

  let newPlan: GeneratedPlan;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    newPlan = buildFallbackPlan(answers, allWorkouts, allRecipes, allChallenges);
  } else {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-opus-4-5",
          max_tokens: 8000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}`);
      const data = await res.json();
      const text: string = data.content?.[0]?.text ?? "";
      const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
      newPlan = JSON.parse(cleaned);
    } catch (err) {
      console.error("Refresh plan generation failed, using fallback:", err);
      newPlan = buildFallbackPlan(answers, allWorkouts, allRecipes, allChallenges);
    }
  }

  // Update ONLY the plan — preserve startedAt so progress is not reset
  await db
    .update(memberPlans)
    .set({ plan: newPlan })
    .where(eq(memberPlans.userId, me.id));

  return NextResponse.json({ ok: true });
}

function buildFallbackPlan(
  answers: QuizAnswers,
  allWorkouts: { id: string; slug: string; title: string; intensity: string | null; durationMin: number | null; thumbnailUrl: string | null }[],
  allRecipes: { id: string; slug: string; title: string; mealType: string; photoUrl: string | null }[],
  allChallenges: { id: string; slug: string; title: string }[]
): GeneratedPlan {
  const intensityMap: Record<string, string[]> = {
    never: ["beginner"],
    some: ["beginner", "intermediate"],
    regular: ["intermediate", "advanced"],
  };
  const allowed = intensityMap[answers.experience] ?? ["beginner", "intermediate"];
  const filtered = allWorkouts.filter((w) => !w.intensity || allowed.includes(w.intensity));
  const pool = filtered.length > 0 ? filtered : allWorkouts;

  const themes = ["Build Your Foundation","Find Your Flow","Power Up","Build the Habit","Momentum","Level Up","Push Through","Finish Strong"];
  const descriptions = [
    "Start easy and build your confidence with the hoop.",
    "Focus on technique and enjoying the movement.",
    "Increase intensity and challenge yourself a little more.",
    "Consistency is key — show up even when it's hard.",
    "You've built the base. Now push into new territory.",
    "Add variety and keep things exciting.",
    "One more week of strong effort — you've got this.",
    "Finish your 8 weeks with energy and pride.",
  ];
  const defaultTips = [
    "Don't worry about keeping the hoop up perfectly yet — just move!",
    "Hydrate well and try to work out at the same time each day.",
    "If you miss a day, just pick up where you left off. No guilt.",
    "Notice how your body feels after each session — that's progress.",
    "You're halfway there. Take a photo to see how far you've come.",
    "Increase your energy by focusing on your breathing during workouts.",
    "Tell someone about your plan — accountability makes it stick.",
    "One week to go! Think about what you want your next 8 weeks to look like.",
  ];

  const recipePool = allRecipes.slice();
  const challengeSlug = allChallenges[0]?.slug ?? null;

  const totalSlots = 8 * answers.daysPerWeek;
  const workoutQueue: typeof pool = [];
  while (workoutQueue.length < totalSlots) {
    const pass = [...pool].sort(() => Math.random() - 0.5);
    workoutQueue.push(...pass);
  }

  const weeks: PlanWeek[] = [];
  let workoutIndex = 0;

  for (let w = 1; w <= 8; w++) {
    const weekWorkouts: PlanWorkoutRef[] = [];
    for (let d = 0; d < answers.daysPerWeek; d++) {
      const wo = workoutQueue[workoutIndex++];
      weekWorkouts.push({
        workoutId: wo.id,
        slug: wo.slug,
        title: wo.title,
        durationMin: wo.durationMin,
        intensity: wo.intensity ?? "beginner",
        thumbnailUrl: wo.thumbnailUrl,
      });
    }
    const weekRecipes: PlanRecipeRef[] = recipePool.splice(0, 2).map((r) => ({
      recipeId: r.id,
      slug: r.slug,
      title: r.title,
      mealType: r.mealType,
      photoUrl: r.photoUrl,
    }));
    weeks.push({
      week: w,
      theme: themes[w - 1],
      description: descriptions[w - 1],
      workouts: weekWorkouts,
      recipes: weekRecipes,
      challengeSlug: w >= 3 && challengeSlug ? challengeSlug : null,
      tip: defaultTips[w - 1],
    });
  }

  const goalTitles: Record<string, string> = {
    weight_loss: "Your 8-Week Fat Loss Hoop Plan",
    toning: "Your 8-Week Tone & Strength Plan",
    cardio: "Your 8-Week Cardio Boost Plan",
    stress_relief: "Your 8-Week Hoop & Chill Plan",
  };
  return {
    title: goalTitles[answers.goal] ?? "Your 8-Week Hoop Plan",
    summary: `${answers.daysPerWeek} workouts a week, built around your goal. Go at your own pace. Consistency beats intensity.`,
    weeks,
  };
}
