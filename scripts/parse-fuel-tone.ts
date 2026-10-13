/**
 * Parses the OCR'd "Fuel and Tone V2" recipe book into structured records.
 * Output: /tmp/fuel-tone-recipes.json
 *
 * Also cross-checks for duplicate content (OCR bug / PDF bug indicators).
 */
import fs from "fs";

type Recipe = {
  index: number;
  title: string;
  category: string;
  titlePageNumber: number;
  detailPageNumber: number;
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

// Fixes common OCR artifacts we saw
function cleanText(s: string): string {
  return s
    .replace(/\bDESCRIPION\b/g, "DESCRIPTION")
    // "Prepara on Time" → "Preparation Time" (OCR loses the "ti" ligature)
    .replace(/\bPrepara\s*on\s+Time\b/gi, "Preparation Time")
    .replace(/\[NIG REI DIE Nise\]?/g, "INGREDIENTS:")
    .replace(/UNIGIRIE DITEIND Ss?/g, "INGREDIENTS:")
    .replace(/INGRIEDIEN TS:/g, "INGREDIENTS:")
    // OCR butchers "PREPARATORY STEPS" many ways, but the heading is always
    // "PREPA" followed by an UPPERCASE letter (PREPARATORY). The body text
    // "Prepara on Time" has a LOWERCASE letter after "Prepa", so keying on
    // the next char's case distinguishes heading from body reliably.
    // Allow uppercase OR whitespace after PREPA (handles "PREPA RAT ORY..." where OCR split the word).
    .replace(/^PREPA[A-Z\s][^\n]*$/gm, "PREPARATORY STEPS:")
    .replace(/^[^\w\n]*S?H?[^\w\n]*O?R?T?[^\w\n]*DESCRIP[^\n]*$/gm, "SHORT DESCRIPTION:")
    .replace(/^NUTRI[A-Z][^\n]*FACTS[^\n]*$/gm, "NUTRITIONAL FACTS (PER SERVING):")
    .trim();
}

function parseMinutes(s: string): number | null {
  const m = s.match(/(\d+)\s*minute/i);
  return m ? parseInt(m[1], 10) : null;
}

function parseServings(s: string): number | null {
  const m = s.match(/Servings?:\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

function parseNutritionNumber(s: string, label: string): number | null {
  const re = new RegExp(label + ":\\s*(\\d+(?:\\.\\d+)?)", "i");
  const m = s.match(re);
  return m ? parseFloat(m[1]) : null;
}

// Split OCR output into pages
function splitPages(raw: string): Map<number, string> {
  const pages = new Map<number, string>();
  const parts = raw.split(/^===PAGE-(\d+)===$/m);
  // parts is [before, num, body, num, body, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const num = parseInt(parts[i], 10);
    const body = cleanText(parts[i + 1] ?? "");
    pages.set(num, body);
  }
  return pages;
}

// From OCR of a PAGE identified as a title page (top has recipe name + description)
function parseTitlePage(text: string) {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  // Title is usually the first meaningful line (sometimes preceded by "RECIPE 01")
  let title = "";
  for (const line of lines) {
    if (/^RECIPE\s*\d+/i.test(line)) continue;
    if (/SHORT DESCRIPTION/i.test(line)) break;
    if (line.length > 2) {
      title = line;
      break;
    }
  }

  // Description is what's between the title and "Preparation Time" (any OCR spelling).
  let description: string | null = null;
  const prepIdx = text.search(/Prepa[\w ]*Time/i);
  if (prepIdx > 0 && title) {
    // Everything between the title and "Preparation Time" — strip known headings
    const titleIdx = text.indexOf(title);
    const raw = text.slice(titleIdx + title.length, prepIdx);
    // Take everything from the first full sentence onwards. A "real sentence"
    // starts with a capital letter and contains typical English (not OCR'd junk
    // like "5) ORT BOIES CR Peine").
    // Heuristic: find the first word-run of 4+ letters that's part of a longer
    // sentence, and slice from there.
    const sentenceStart = raw.match(/[A-Z][a-z]{3,}[^.!?]{30,}[.!?]/);
    const slice = sentenceStart
      ? raw.slice(sentenceStart.index).replace(/\s+/g, " ").trim()
      : "";
    // Keep the last paragraph (usually the description) — drop leading OCR noise.
    // We look for a sentence-like run of at least 40 chars.
    const sentences = slice.match(/[A-Z][^.!?]{20,}[.!?]/g);
    if (sentences && sentences.length) {
      description = sentences.join(" ").trim();
    } else if (slice.length > 30) {
      description = slice;
    }
  }

  // Match "Preparation Time", "Prepara on Time", or any OCR variant.
  const prep = parseMinutes((text.match(/Prepa[\w ]*Time[:]?\s*([^\n]+)/i) || [])[1] ?? "");
  const cook = parseMinutes((text.match(/Cooking Time[:]?\s*([^\n]+)/i) || [])[1] ?? "");
  const servings = parseServings(text);

  return { title, description, prepTimeMin: prep, cookTimeMin: cook, servings };
}

function parseDetailPage(text: string) {
  // Ingredients: from INGREDIENTS: to PREPARATORY STEPS:
  const ingMatch = text.match(/INGREDIENTS[:]?\s*([\s\S]*?)PREPARATORY STEPS/i);
  let ingredients: string[] = [];
  if (ingMatch) {
    ingredients = ingMatch[1]
      .split(/\n/)
      .map((l) => l.replace(/^[•*+>»\-]\s*/, "").trim())
      .filter((l) => l.length > 2);
  }

  const stepsMatch = text.match(/PREPARATORY STEPS[:]?\s*([\s\S]*?)NUTRITIONAL FACTS/i);
  let steps: string[] = [];
  if (stepsMatch) {
    // Steps are numbered 1. 2. 3. — group multi-line steps
    const raw = stepsMatch[1];
    const parts = raw.split(/(?:^|\n)\s*(\d+)\.\s*/).filter(Boolean);
    // parts will alternate [number, body, number, body...] starting with number
    for (let i = 0; i < parts.length; i += 2) {
      const body = parts[i + 1];
      if (body) steps.push(body.replace(/\s+/g, " ").trim());
    }
  }

  const nutritionBlock = text.match(/NUTRITIONAL FACTS[\s\S]*$/i)?.[0] ?? "";
  const calories = parseNutritionNumber(nutritionBlock, "Calories");
  const proteinG = parseNutritionNumber(nutritionBlock, "Protein");
  const fatG = parseNutritionNumber(nutritionBlock, "Fat");
  const carbsG = parseNutritionNumber(nutritionBlock, "Carbs");
  const fiberG = parseNutritionNumber(nutritionBlock, "Fiber");
  const sugarG = parseNutritionNumber(nutritionBlock, "Sugar");

  return { ingredients, steps, calories, proteinG, fatG, carbsG, fiberG, sugarG };
}

// Structure:
//   page 1 = cover
//   page 2 = first category divider
//   recipes are pairs: page N (title) + page N+1 (detail)
//   category dividers are single pages interspersed between recipes
const CATEGORY_DIVIDER_PAGES: Record<number, string> = {
  2: "Power Breakfasts",
  17: "Strong Lunches",
  32: "Strength Dinners",
  45: "On-the-Go Snacks",
  56: "Smart Desserts",
};

function buildRecipeRanges(): Array<{ titlePage: number; detailPage: number; category: string }> {
  const ranges: Array<{ titlePage: number; detailPage: number; category: string }> = [];
  let currentCategory = "";
  let i = 2; // skip cover
  while (i <= 64) {
    if (CATEGORY_DIVIDER_PAGES[i]) {
      currentCategory = CATEGORY_DIVIDER_PAGES[i];
      i += 1;
      continue;
    }
    ranges.push({ titlePage: i, detailPage: i + 1, category: currentCategory });
    i += 2;
  }
  return ranges;
}

function main() {
  const raw = fs.readFileSync("/tmp/fuel-tone-all.txt", "utf8");
  const pages = splitPages(raw);
  const ranges = buildRecipeRanges();

  const recipes: Recipe[] = [];
  const seenIngHashes = new Map<string, number>();

  ranges.forEach((r, idx) => {
    const titleText = pages.get(r.titlePage) ?? "";
    const detailText = pages.get(r.detailPage) ?? "";
    const tp = parseTitlePage(titleText);
    const dp = parseDetailPage(detailText);

    const issues: string[] = [];

    // Check for the Spicy Veggie Omelette type bug: did description mention a DIFFERENT recipe?
    if (tp.description) {
      const d = tp.description.toLowerCase();
      if (!tp.title.toLowerCase().split(" ").some((w) => w.length > 4 && d.includes(w.toLowerCase()))) {
        // description doesn't contain any word from title (> 4 chars)
        issues.push("Description may not match title");
      }
    }

    // Flag duplicate ingredients across recipes
    const ingHash = dp.ingredients.slice(0, 3).join("|").toLowerCase();
    if (ingHash && seenIngHashes.has(ingHash)) {
      issues.push(
        `Duplicate ingredients with recipe #${seenIngHashes.get(ingHash)} — content may be copy-pasted in PDF`
      );
    } else if (ingHash) {
      seenIngHashes.set(ingHash, idx + 1);
    }

    if (!dp.ingredients.length) issues.push("No ingredients parsed");
    if (!dp.steps.length) issues.push("No steps parsed");

    // Suspicious numeric OCR — typical recipes are 50–800 cal
    if (dp.calories !== null && dp.calories < 50) {
      issues.push(`Calories ${dp.calories} looks too low — likely OCR misread a digit (verify in PDF)`);
    }
    if (dp.proteinG !== null && dp.proteinG < 2) {
      issues.push(`Protein ${dp.proteinG}g looks too low — likely OCR misread`);
    }

    recipes.push({
      index: idx + 1,
      title: tp.title,
      category: r.category,
      titlePageNumber: r.titlePage,
      detailPageNumber: r.detailPage,
      description: tp.description,
      prepTimeMin: tp.prepTimeMin,
      cookTimeMin: tp.cookTimeMin,
      servings: tp.servings,
      ingredients: dp.ingredients,
      steps: dp.steps,
      calories: dp.calories,
      proteinG: dp.proteinG,
      fatG: dp.fatG,
      carbsG: dp.carbsG,
      fiberG: dp.fiberG,
      sugarG: dp.sugarG,
      issues,
    });
  });

  fs.writeFileSync("/tmp/fuel-tone-recipes.json", JSON.stringify(recipes, null, 2));

  // Summary
  console.log(`Parsed ${recipes.length} recipes:\n`);
  const byCat = new Map<string, Recipe[]>();
  for (const r of recipes) {
    if (!byCat.has(r.category)) byCat.set(r.category, []);
    byCat.get(r.category)!.push(r);
  }
  for (const [cat, list] of byCat) {
    console.log(`## ${cat} (${list.length})`);
    for (const r of list) {
      const flag = r.issues.length ? "⚠️ " : "  ";
      console.log(
        `  ${flag}${r.index.toString().padStart(2)}. ${r.title}  (${r.calories ?? "?"} cal, ${r.proteinG ?? "?"}g P, ${r.ingredients.length} ing, ${r.steps.length} steps)`
      );
      if (r.issues.length) {
        for (const issue of r.issues) console.log(`      └─ ${issue}`);
      }
    }
  }

  const withIssues = recipes.filter((r) => r.issues.length).length;
  console.log(`\n${recipes.length - withIssues} clean, ${withIssues} with issues.`);
  console.log(`\nFull JSON: /tmp/fuel-tone-recipes.json`);
}

main();
