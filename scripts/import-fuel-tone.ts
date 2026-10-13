/**
 * Imports parsed Fuel & Tone recipes into Supabase.
 * - Wipes existing demo recipes (they're placeholder content only)
 * - Inserts all 29 with photos pointing at /recipes/<slug>.jpg
 * - Applies the known corrections (egg muffin calories, omelette blanking)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import fs from "fs";
import { db, recipes, groceryLists } from "@/lib/db";

type Parsed = {
  index: number;
  title: string;
  category: string;
  description: string | null;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  servings: number | null;
  ingredients: string[];
  steps: string[];
  calories: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  issues: string[];
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[&']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function categoryToMealType(cat: string): string {
  if (cat.includes("Breakfast")) return "breakfast";
  if (cat.includes("Lunch")) return "lunch";
  if (cat.includes("Dinner")) return "dinner";
  if (cat.includes("Snack")) return "snack";
  if (cat.includes("Dessert")) return "dessert";
  return "snack";
}

function detectDietaryTags(ingredients: string[]): string[] {
  const ingText = ingredients.join(" ").toLowerCase();
  const tags: string[] = [];

  // High-protein — the whole book is high-protein
  tags.push("high-protein");

  // Gluten-free heuristic: no mention of flour/bread/pasta/oats/breadcrumbs
  const glutenKeywords = /\b(flour|bread|pasta|oats|wheat|breadcrumb|tortilla|crouton)\b/;
  if (!glutenKeywords.test(ingText)) tags.push("gluten-free");

  // Dairy-free heuristic: no mention of dairy items
  const dairyKeywords = /\b(cheese|yogurt|milk|butter|cream|parmesan|feta|cheddar)\b/;
  if (!dairyKeywords.test(ingText)) tags.push("dairy-free");

  // Vegetarian heuristic: no meat
  const meatKeywords = /\b(chicken|beef|turkey|pork|salmon|tuna|shrimp|cod|jerky|fish|bacon)\b/;
  if (!meatKeywords.test(ingText)) tags.push("vegetarian");

  return tags;
}

function ingredientAisle(item: string): string | undefined {
  const lower = item.toLowerCase();
  if (/\b(chicken|beef|turkey|pork|bacon|jerky)\b/.test(lower)) return "Meat";
  if (/\b(salmon|tuna|shrimp|cod|fish)\b/.test(lower)) return "Seafood";
  if (/\b(yogurt|cheese|milk|butter|cream|parmesan|feta|cheddar|cottage)\b/.test(lower)) return "Dairy";
  if (/\b(egg)/.test(lower)) return "Dairy";
  if (/\b(spinach|kale|lettuce|avocado|tomato|onion|pepper|broccoli|cauliflower|zucchini|brussels|carrot|cilantro|parsley|chive|garlic|lemon|lime|berries|strawberr|blueberr|raspberr|cherr)\b/.test(lower)) return "Produce";
  if (/\b(quinoa|oats|rice|flour|chia|almond|walnut|cashew|nut)\b/.test(lower)) return "Pantry";
  if (/\b(olive oil|salt|pepper|seasoning|paprika|cumin|cayenne|chili|vanilla|honey|syrup|tahini|soy|sauce)\b/.test(lower)) return "Pantry";
  return undefined;
}

async function main() {
  const parsed = JSON.parse(fs.readFileSync("/tmp/fuel-tone-recipes.json", "utf8")) as Parsed[];

  // Wipe existing recipes (demo + any previous imports). Grocery lists reference
  // recipes by id — also clear those so we don't leave dangling references.
  await db.delete(groceryLists);
  await db.delete(recipes);
  console.log("Cleared existing recipes and grocery lists.\n");

  // --- Apply known corrections ---
  const CORRECTIONS: Record<number, Partial<Parsed>> = {
    4: { calories: 90 }, // OCR misread 90 as 30
  };

  const RECIPES_TO_BLANK = new Set([3]); // Spicy Veggie Omelette has wrong PDF content

  let inserted = 0;
  for (const r of parsed) {
    const correction = CORRECTIONS[r.index];
    const rec = correction ? { ...r, ...correction } : r;
    const shouldBlank = RECIPES_TO_BLANK.has(r.index);

    const slug = slugify(rec.title);
    const mealType = categoryToMealType(rec.category);
    const dietaryTags = shouldBlank ? ["high-protein"] : detectDietaryTags(rec.ingredients);

    const description = shouldBlank
      ? `⚠️ This recipe's content needs to be updated (PDF had a copy-paste error). Please edit via /admin/content.`
      : rec.description;

    const ingredients = shouldBlank
      ? []
      : rec.ingredients.map((item) => ({ item, amount: "", aisle: ingredientAisle(item) }));

    const steps = shouldBlank ? [] : rec.steps;

    const totalTime = (rec.prepTimeMin ?? 0) + (rec.cookTimeMin ?? 0) || null;

    await db.insert(recipes).values({
      slug,
      title: rec.title,
      description,
      mealType,
      dietaryTags,
      timeMin: totalTime,
      servings: rec.servings ?? 1,
      calories: rec.calories,
      proteinG: rec.proteinG,
      carbsG: rec.carbsG,
      fatG: rec.fatG,
      ingredients: ingredients as any,
      steps,
      photoUrl: `/recipes/${slug}.jpg`,
      publishedAt: new Date(),
    });

    const flag = shouldBlank ? "⚠️ " : "  ";
    console.log(`${flag}${rec.index.toString().padStart(2)}. ${rec.title}`);
    inserted++;
  }

  console.log(`\n✅ Imported ${inserted} recipes to Supabase.`);
  console.log(`   Photos at /public/recipes/*.jpg`);
}

main().catch(console.error).finally(() => process.exit(0));
