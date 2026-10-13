/**
 * Scans a folder of video files and generates a CSV template for bulk import.
 *
 * Usage:
 *   npx tsx scripts/scan-workouts.ts [folder-path]
 *
 * Defaults to ~/Desktop/infinity-hoop-workouts
 * Outputs: ~/Desktop/infinity-hoop-workouts/_import.csv
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import os from "os";

const VIDEO_EXTS = new Set([".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi"]);

function titleFromFilename(filename: string): string {
  const base = path.parse(filename).name;
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+/g, " ")
    .trim();
}

function guessDuration(filename: string): number {
  // Try to parse "20min", "20-min", "20m" from filename
  const match = filename.match(/(\d+)\s*[-_]?\s*m(?:in)?(?:ute)?s?/i);
  if (match) {
    const n = parseInt(match[1], 10);
    if (n >= 5 && n <= 90) return n;
  }
  return 25; // sensible default
}

function guessIntensity(filename: string): "beginner" | "intermediate" | "advanced" {
  const lower = filename.toLowerCase();
  if (/\b(beginner|easy|gentle|starter|slow)\b/.test(lower)) return "beginner";
  if (/\b(advanced|intense|hard|expert|pro|sweat)\b/.test(lower)) return "advanced";
  return "intermediate";
}

function guessBodyFocus(filename: string): string {
  const lower = filename.toLowerCase();
  const tags: string[] = [];
  if (/\b(core|abs|belly)\b/.test(lower)) tags.push("core");
  if (/\b(glute|booty|butt|bum)\b/.test(lower)) tags.push("glutes");
  if (/\b(leg|lower|quad|hamstring)\b/.test(lower)) tags.push("legs");
  if (/\b(arm|upper|shoulder)\b/.test(lower)) tags.push("arms");
  if (/\b(cardio|dance|hiit)\b/.test(lower)) tags.push("cardio");
  if (tags.length === 0) tags.push("full-body");
  return tags.join("|");
}

function main() {
  const folder = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(os.homedir(), "Desktop", "infinity-hoop-workouts");

  if (!fs.existsSync(folder)) {
    console.error(`❌ Folder not found: ${folder}`);
    console.error(`   Create it and drop your video files in it, then rerun.`);
    process.exit(1);
  }

  const entries = fs
    .readdirSync(folder)
    .filter((f) => VIDEO_EXTS.has(path.extname(f).toLowerCase()))
    .sort();

  if (entries.length === 0) {
    console.error(`❌ No video files found in ${folder}`);
    console.error(`   Supported: .mp4, .mov, .m4v, .mkv, .webm, .avi`);
    process.exit(1);
  }

  console.log(`Found ${entries.length} video file(s) in ${folder}:\n`);
  entries.forEach((f, i) => {
    const stat = fs.statSync(path.join(folder, f));
    console.log(`  ${i + 1}. ${f}  (${(stat.size / (1024 * 1024)).toFixed(1)} MB)`);
  });

  // Generate CSV template
  const header = [
    "filename",
    "title",
    "description",
    "durationMin",
    "intensity",
    "bodyFocus",
    "instructor",
    "usesHoop",
  ].join(",");

  const rows = entries.map((f) => {
    const title = titleFromFilename(f);
    const durationMin = guessDuration(f);
    const intensity = guessIntensity(f);
    const bodyFocus = guessBodyFocus(f);
    return [
      csvEscape(f),
      csvEscape(title),
      csvEscape(""), // description blank — fill in if you want
      String(durationMin),
      intensity,
      csvEscape(bodyFocus),
      csvEscape(""),   // instructor
      "true",
    ].join(",");
  });

  const outPath = path.join(folder, "_import.csv");
  fs.writeFileSync(outPath, [header, ...rows].join("\n"));

  console.log(`\n✅ CSV template written to:\n   ${outPath}`);
  console.log(
    `\n👉 Next: open the CSV in Numbers/Excel/Google Sheets, edit titles/\n   descriptions/etc., save it back as CSV, then run:\n   npx tsx scripts/bulk-import-workouts.ts`
  );
}

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

main();
