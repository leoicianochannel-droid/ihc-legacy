import { put } from "@vercel/blob";
import { readFileSync, readdirSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const envPath = join(dirname(fileURLToPath(import.meta.url)), "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^=]+)="?([^"]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const SRC_DIR = join(process.env.HOME, "Desktop/challenges");
const files = readdirSync(SRC_DIR).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));

console.log(`Uploading ${files.length} challenge covers...\n`);

for (const file of files) {
  const ext = extname(file).toLowerCase();
  const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  process.stdout.write(`  ${file} ... `);
  try {
    const data = readFileSync(join(SRC_DIR, file));
    const blob = await put(`challenges/${file}`, data, { access: "public", contentType, addRandomSuffix: false });
    console.log(`✓  ${blob.url}`);
  } catch (err) {
    console.log(`✗ ${err.message}`);
  }
}
