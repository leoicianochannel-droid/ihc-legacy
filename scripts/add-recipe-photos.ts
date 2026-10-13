/**
 * Adds curated Unsplash photos to the seeded demo recipes.
 * Run: npx tsx scripts/add-recipe-photos.ts
 *
 * (Unsplash photos are free-to-use. When you upload real photos via the
 * admin panel, they'll replace these automatically.)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { db, recipes } from "@/lib/db";
import { eq } from "drizzle-orm";

const PHOTOS: Record<string, string> = {
  "high-protein-berry-bowl":
    "https://images.unsplash.com/photo-1590301157890-4810ed352733?w=1200&q=80",
  "turkey-taco-lettuce-cups":
    "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=1200&q=80",
  "savory-protein-oats":
    "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=1200&q=80",
  "chicken-power-bowl":
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200&q=80",
  "chocolate-protein-smoothie":
    "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=1200&q=80",
};

async function main() {
  const all = await db.select().from(recipes);
  console.log(`Found ${all.length} recipes.`);

  let updated = 0;
  for (const r of all) {
    const photoUrl = PHOTOS[r.slug];
    if (!photoUrl) {
      console.log(`  skip "${r.title}" (no mapped photo)`);
      continue;
    }
    await db.update(recipes).set({ photoUrl }).where(eq(recipes.id, r.id));
    console.log(`  ✓ ${r.title}`);
    updated++;
  }

  console.log(`\nUpdated ${updated} recipe(s) with photos.`);
}

main().catch(console.error).finally(() => process.exit(0));
