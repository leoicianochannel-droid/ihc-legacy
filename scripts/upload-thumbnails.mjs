/**
 * Uploads workout thumbnails from ~/Desktop/new images/ to Vercel Blob.
 * Prints a JSON mapping of filename → blob URL when done.
 *
 * Run: node scripts/upload-thumbnails.mjs
 * Requires BLOB_READ_WRITE_TOKEN in .env.local
 */
import { put } from "@vercel/blob";
import { readFileSync, readdirSync } from "fs";
import { join, extname, basename } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Load .env.local manually
const envPath = join(dirname(fileURLToPath(import.meta.url)), "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^=]+)="?([^"]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const SRC_DIR = join(process.env.HOME, "Desktop/new images");
const files = readdirSync(SRC_DIR).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));

console.log(`Uploading ${files.length} thumbnails...\n`);

const results = {};

for (const file of files) {
  const filePath = join(SRC_DIR, file);
  const ext = extname(file).toLowerCase();
  const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

  process.stdout.write(`  ${file} ... `);
  try {
    const data = readFileSync(filePath);
    const blob = await put(`thumbnails/${file}`, data, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    results[file] = blob.url;
    console.log("✓");
  } catch (err) {
    console.log(`✗ ${err.message}`);
  }
}

console.log("\n=== Upload results ===");
console.log(JSON.stringify(results, null, 2));
