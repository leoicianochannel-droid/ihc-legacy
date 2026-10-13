/**
 * Reads the parsed recipes JSON, crops the hero photo from each title page,
 * and saves to /public/recipes/<slug>.jpg.
 *
 * Photos are shipped with the app (no external blob store needed for MVP).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "recipes");
const PAGES_DIR = "/tmp/fuel-tone-pages";
const RECIPES_JSON = "/tmp/fuel-tone-recipes.json";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[&']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const recipes = JSON.parse(fs.readFileSync(RECIPES_JSON, "utf8"));

  console.log(`Cropping ${recipes.length} photos to ${OUT_DIR}\n`);

  for (const r of recipes) {
    const slug = slugify(r.title);
    const srcPage = path.join(PAGES_DIR, `page-${String(r.titlePageNumber).padStart(2, "0")}.png`);
    const outPath = path.join(OUT_DIR, `${slug}.jpg`);

    if (!fs.existsSync(srcPage)) {
      console.log(`  ✗ ${slug}: source page not found (${srcPage})`);
      continue;
    }

    // Crop the photo region from the title page, trim whitespace, convert to jpg (smaller).
    execSync(
      `/opt/homebrew/bin/magick "${srcPage}" -crop 700x470+64+220 -trim +repage -quality 82 "${outPath}"`,
      { stdio: "pipe" }
    );

    const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(0);
    console.log(`  ✓ ${slug.padEnd(45)} ${sizeKb} KB`);
  }

  const totalKb = fs.readdirSync(OUT_DIR)
    .filter((f) => f.endsWith(".jpg"))
    .reduce((sum, f) => sum + fs.statSync(path.join(OUT_DIR, f)).size, 0) / 1024;

  console.log(`\nTotal: ${(totalKb / 1024).toFixed(2)} MB across ${recipes.length} photos`);
}

main();
