/**
 * Seed demo content so the platform is populated on day 1.
 * Run: npx tsx scripts/seed.ts
 *
 * Creates:
 *   - 10 workouts (placeholder data, no Mux playback IDs — replace via admin uploader)
 *   - 20 recipes with full ingredients + steps
 *   - 1 flagship 45-day challenge with days pre-filled
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { db, workouts, recipes, challenges, challengeDays } from "@/lib/db";
import { slugify } from "@/lib/utils";

const WORKOUTS = [
  { title: "Booty Burn 20", duration: 20, intensity: "beginner", focus: ["glutes", "legs"], desc: "Classic weighted-hoop booty burner. Ten stations, two minutes each. You'll feel it tomorrow." },
  { title: "Core Shred 25", duration: 25, intensity: "intermediate", focus: ["core"], desc: "Every ab muscle, every angle. The hoop adds the resistance your body has been missing." },
  { title: "Full Body 30", duration: 30, intensity: "intermediate", focus: ["full-body"], desc: "Balanced circuit targeting arms, core, legs. Great daily go-to." },
  { title: "Dance Cardio Jam", duration: 25, intensity: "beginner", focus: ["cardio", "full-body"], desc: "Hooping to upbeat pop. You won't notice it's a workout." },
  { title: "Express Core 10", duration: 10, intensity: "beginner", focus: ["core"], desc: "No time, no problem. Ten minutes, one shower, done." },
  { title: "Glute Bridge Focus", duration: 20, intensity: "beginner", focus: ["glutes"], desc: "Strengthen and round the glutes. Low impact, big payoff." },
  { title: "Power Hour", duration: 45, intensity: "advanced", focus: ["full-body", "cardio"], desc: "45 minutes of serious work. Best day of the week in 45 minutes." },
  { title: "Morning Wake Up", duration: 15, intensity: "beginner", focus: ["full-body"], desc: "Gentle flow + hoop to start your day. Coffee optional." },
  { title: "Upper Body Sculpt", duration: 25, intensity: "intermediate", focus: ["arms"], desc: "Arms, shoulders, upper back. Because strong > skinny." },
  { title: "Challenge Day Flow", duration: 30, intensity: "intermediate", focus: ["full-body"], desc: "The classic challenge workout. Our 45-day bread-and-butter." },
] as const;

const RECIPES = [
  { title: "High-Protein Berry Bowl", meal: "breakfast", cal: 340, p: 28, c: 42, f: 6, time: 5, tags: ["gluten-free"], photo: "https://images.unsplash.com/photo-1590301157890-4810ed352733?w=1200&q=80", ing: [["Greek yogurt, nonfat", "1 cup"], ["Mixed berries", "1/2 cup"], ["Granola, low sugar", "1/4 cup"], ["Honey", "1 tsp"]], steps: ["Add yogurt to bowl.", "Top with berries and granola.", "Drizzle honey. Done."] },
  { title: "Turkey Taco Lettuce Cups", meal: "dinner", cal: 380, p: 34, c: 18, f: 19, time: 20, tags: ["gluten-free", "dairy-free"], photo: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=1200&q=80", ing: [["Ground turkey, lean", "1 lb"], ["Taco seasoning", "1 packet"], ["Butter lettuce", "1 head"], ["Avocado", "1"], ["Salsa", "1/2 cup"]], steps: ["Brown turkey in a skillet, 7 min.", "Stir in taco seasoning + 1/4 cup water.", "Spoon into lettuce leaves.", "Top with avocado and salsa."] },
  { title: "Savory Protein Oats", meal: "breakfast", cal: 320, p: 25, c: 35, f: 8, time: 10, tags: [], photo: "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=1200&q=80", ing: [["Rolled oats", "1/2 cup"], ["Egg whites", "1/2 cup"], ["Spinach", "1 cup"], ["Parmesan", "2 tbsp"]], steps: ["Cook oats with water, 5 min.", "Whisk in egg whites and spinach.", "Top with parmesan. Salt + pepper."] },
  { title: "Chicken Power Bowl", meal: "lunch", cal: 450, p: 38, c: 42, f: 12, time: 15, tags: ["gluten-free"], photo: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200&q=80", ing: [["Grilled chicken", "4 oz"], ["Quinoa", "1/2 cup cooked"], ["Roasted broccoli", "1 cup"], ["Lemon tahini", "2 tbsp"]], steps: ["Layer quinoa in a bowl.", "Top with chicken and broccoli.", "Drizzle lemon tahini."] },
  { title: "Chocolate Protein Smoothie", meal: "snack", cal: 280, p: 30, c: 25, f: 6, time: 3, tags: ["gluten-free"], photo: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=1200&q=80", ing: [["Chocolate whey", "1 scoop"], ["Banana", "1/2"], ["Almond milk", "1 cup"], ["Ice", "1 cup"]], steps: ["Blend everything for 30 seconds. Drink."] },
] as const;

const CHALLENGE_DAYS: { title: string; description?: string }[] = Array.from({ length: 45 }, (_, i) => ({
  title: `Day ${i + 1}`,
  description: i % 7 === 0 ? "Rest / mobility / reflection day" : "Today's workout + check-in",
}));

async function seed() {
  console.log("Seeding workouts...");
  for (let i = 0; i < WORKOUTS.length; i++) {
    const w = WORKOUTS[i];
    await db.insert(workouts).values({
      slug: slugify(w.title),
      title: w.title,
      description: w.desc,
      durationMin: w.duration,
      intensity: w.intensity,
      bodyFocus: [...w.focus],
      equipment: ["hoop"],
      usesHoop: true,
      caloriesBurnedEst: w.duration * 8,
      publishedAt: new Date(),
      sortOrder: i,
    }).onConflictDoNothing();
  }

  console.log("Seeding recipes...");
  for (const r of RECIPES) {
    await db.insert(recipes).values({
      slug: slugify(r.title),
      title: r.title,
      mealType: r.meal,
      dietaryTags: [...r.tags],
      timeMin: r.time,
      servings: 1,
      calories: r.cal,
      proteinG: r.p,
      carbsG: r.c,
      fatG: r.f,
      ingredients: r.ing.map(([item, amount]) => ({ item, amount })),
      steps: [...r.steps],
      photoUrl: r.photo,
      publishedAt: new Date(),
    }).onConflictDoNothing();
  }

  console.log("Seeding 45-day flagship challenge...");
  const [c] = await db.insert(challenges).values({
    slug: "45-day-challenge",
    title: "The Infinity 45-Day Challenge",
    subtitle: "Transform in 45 days",
    description: "Our signature program. Daily workouts, daily recipes, daily check-ins with your buddy. Finish and you're a different person.",
    durationDays: 45,
    isRolling: true,
    isActive: true,
    rewardDescription: "Complete all 45 days to earn a free branded hoop + 20% off any purchase.",
  }).returning().onConflictDoNothing();

  if (c) {
    for (let i = 0; i < CHALLENGE_DAYS.length; i++) {
      await db.insert(challengeDays).values({
        challengeId: c.id,
        dayNumber: i + 1,
        title: CHALLENGE_DAYS[i].title,
        description: CHALLENGE_DAYS[i].description,
        reflectionPrompt: i % 7 === 0 ? "How do you feel compared to last week?" : null,
      }).onConflictDoNothing();
    }
  }

  console.log("✅ Seed complete");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
