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

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", q);
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", "30");
  url.searchParams.set("fields", "id,product_name,brands,nutriments,serving_size");
  url.searchParams.set("lc", "en");
  url.searchParams.set("sort_by", "unique_scans_n");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "InfinityHoop-NutritionTracker/1.0" },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return NextResponse.json({ results: [] });

  const data = await res.json();
  const results: FoodSearchResult[] = (data.products ?? [])
    .filter((p: any) => {
      const n = p.nutriments ?? {};
      if (!p.product_name) return false;
      if (typeof n["energy-kcal_100g"] !== "number" || n["energy-kcal_100g"] <= 0) return false;
      // Skip products with non-Latin names (obvious foreign language results)
      if (/[^\x00-\x7FÀ-ɏ]/.test(p.product_name)) return false;
      return true;
    })
    .slice(0, 10)
    .map((p: any) => {
      const n = p.nutriments ?? {};
      return {
        id: p.id ?? p.code ?? String(Math.random()),
        name: p.product_name,
        brand: p.brands?.split(",")[0]?.trim() || undefined,
        per100g: {
          calories: Math.round(n["energy-kcal_100g"] ?? 0),
          proteinG: Math.round((n["proteins_100g"] ?? 0) * 10) / 10,
          carbsG: Math.round((n["carbohydrates_100g"] ?? 0) * 10) / 10,
          fatG: Math.round((n["fat_100g"] ?? 0) * 10) / 10,
        },
      };
    });

  return NextResponse.json({ results });
}
