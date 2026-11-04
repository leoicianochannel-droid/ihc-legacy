import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export interface FoodSearchResult {
  id: string;
  name: string;
  brand?: string;
  per100g: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
}

// USDA FoodData Central nutrient IDs
const NID_CALORIES = 1008;
const NID_PROTEIN  = 1003;
const NID_CARBS    = 1005;
const NID_FAT      = 1004;

function getNutrient(nutrients: Array<{ nutrientId: number; value: number }>, id: number): number {
  return nutrients.find((n) => n.nutrientId === id)?.value ?? 0;
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    console.error("USDA_API_KEY is not configured");
    return NextResponse.json({ results: [], error: "nutrition_unavailable" });
  }

  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", q);
  url.searchParams.set("pageSize", "25");
  // Include Foundation (raw foods), SR Legacy (standard reference), and Branded
  url.searchParams.set("dataType", "Foundation,SR Legacy,Branded Food");

  const res = await fetch(url.toString(), {
    next: { revalidate: 3600 },
  });

  if (!res.ok) return NextResponse.json({ results: [] });

  const data = await res.json();

  const results: FoodSearchResult[] = (data.foods ?? [])
    .filter((f: any) => {
      if (!f.description) return false;
      const nutrients: Array<{ nutrientId: number; value: number }> = f.foodNutrients ?? [];
      const cal = getNutrient(nutrients, NID_CALORIES);
      return cal > 0;
    })
    .slice(0, 10)
    .map((f: any) => {
      const nutrients: Array<{ nutrientId: number; value: number }> = f.foodNutrients ?? [];
      return {
        id: String(f.fdcId),
        name: f.description,
        brand: f.brandOwner?.trim() || f.brandName?.trim() || undefined,
        per100g: {
          calories: Math.round(getNutrient(nutrients, NID_CALORIES)),
          proteinG: Math.round(getNutrient(nutrients, NID_PROTEIN) * 10) / 10,
          carbsG:   Math.round(getNutrient(nutrients, NID_CARBS)   * 10) / 10,
          fatG:     Math.round(getNutrient(nutrients, NID_FAT)     * 10) / 10,
        },
      };
    });

  return NextResponse.json({ results });
}
