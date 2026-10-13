/**
 * Scans ~/Desktop/infinity-hoop-workouts and classifies every video:
 *   - Top-level files  → standalone workouts (no collection)
 *   - Subfolder files  → workouts in a collection (folder name)
 *   - "45 Day Challenge" folder → challengeOnly = true, linked to 6-week challenge
 *
 * Outputs a CSV preview + summary. Doesn't upload anything.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import os from "os";

const ROOT = path.join(os.homedir(), "Desktop", "infinity-hoop-workouts");
const VIDEO_EXTS = new Set([".mp4", ".mov", ".m4v", ".mkv", ".webm"]);

// Folder-name normalization: "45 Day Challenege" → challenge, "2 Week Pre-Hoop" → literal
function normalizeFolderName(name: string): string {
  return name.replace(/[_-]+/g, " ").trim();
}

function isChallengeFolder(folderName: string): boolean {
  // Match "45 Day Challenge", "45-Day Challenege" (typo), "6 Week Challenge", etc.
  return /\b(challenge|challenege)\b/i.test(folderName);
}

function prettifyTitle(filename: string, folder: string | null): string {
  let base = path.parse(filename).name;
  // Strip trailing "-NNN" upload sequence numbers (like "-008", "-012")
  base = base.replace(/-\d{2,4}$/, "");
  // Turn underscores/dashes into spaces
  base = base.replace(/[_]+/g, " ").trim();
  // Collapse multiple spaces
  base = base.replace(/\s+/g, " ");
  // Remove "(1)" etc.
  base = base.replace(/\s*\(\d+\)\s*/g, " ").trim();
  // If in a collection folder, prefix with nothing — we already have collection
  return base;
}

function guessIntensity(filename: string, folder: string | null): "beginner" | "intermediate" | "advanced" {
  const text = (folder + " " + filename).toLowerCase();
  if (/\b(advanced|intense|pro|challenge|sweat)\b/.test(text)) return "advanced";
  if (/\b(beginner|pre-hoop|gentle|easy|starter|chair|seated)\b/.test(text)) return "beginner";
  if (/\b(slim down|burn|cardio|remix|queen)\b/.test(text)) return "intermediate";
  return "intermediate";
}

function guessBodyFocus(filename: string, folder: string | null): string[] {
  const text = (folder + " " + filename).toLowerCase();
  const tags: string[] = [];
  if (/\b(core|abs|crunch|twist|plank|bicycle)\b/.test(text)) tags.push("core");
  if (/\b(glute|booty|butt|bridge|kick)\b/.test(text)) tags.push("glutes");
  if (/\b(leg|lunge|squat|calf|hamstring)\b/.test(text)) tags.push("legs");
  if (/\b(arm|shoulder|push|press)\b/.test(text)) tags.push("arms");
  if (/\b(cardio|dance|hiit|jump|remix|fast)\b/.test(text)) tags.push("cardio");
  if (/\b(stretch|yoga|flow|breath|child|downward|cat cow|pose|sun)\b/.test(text)) tags.push("flexibility");
  if (tags.length === 0) tags.push("full-body");
  return tags;
}

// Rough duration guess — huge GB files are usually full classes, small files are exercise demos
function guessDurationMin(sizeBytes: number): number {
  const gb = sizeBytes / (1024 ** 3);
  if (gb >= 3) return 45;       // Full classes are ~3+ GB
  if (gb >= 1.5) return 30;
  if (gb >= 0.8) return 20;
  if (gb >= 0.3) return 15;
  if (gb >= 0.1) return 5;
  return 2;                      // Short demos (Pre-Hoop individual exercises)
}

type VideoRow = {
  relativePath: string;          // e.g. "2 Week Pre-Hoop/Bird dogs.mp4"
  filename: string;
  fullPath: string;
  folder: string | null;         // null = top-level
  collection: string | null;     // e.g. "2 Week Pre-Hoop" or null
  challengeOnly: boolean;
  title: string;
  sizeMB: number;
  durationMinGuess: number;
  intensity: string;
  bodyFocus: string[];
};

function scan(): VideoRow[] {
  const rows: VideoRow[] = [];

  // Top-level files
  for (const entry of fs.readdirSync(ROOT)) {
    const fullPath = path.join(ROOT, entry);
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) continue;
    const ext = path.extname(entry).toLowerCase();
    if (!VIDEO_EXTS.has(ext)) continue;

    rows.push({
      relativePath: entry,
      filename: entry,
      fullPath,
      folder: null,
      collection: null,
      challengeOnly: false,
      title: prettifyTitle(entry, null),
      sizeMB: stat.size / (1024 * 1024),
      durationMinGuess: guessDurationMin(stat.size),
      intensity: guessIntensity(entry, null),
      bodyFocus: guessBodyFocus(entry, null),
    });
  }

  // Subfolder files
  for (const dir of fs.readdirSync(ROOT)) {
    const dirPath = path.join(ROOT, dir);
    const dirStat = fs.statSync(dirPath);
    if (!dirStat.isDirectory()) continue;
    if (dir.startsWith(".")) continue;

    const normalizedFolder = normalizeFolderName(dir);
    const challenge = isChallengeFolder(dir);
    // For collection name: use normalized, but for challenge, store as null
    // (challenge videos are tracked separately via challenge_days)
    const collection = challenge ? null : normalizedFolder;

    for (const entry of fs.readdirSync(dirPath)) {
      const fullPath = path.join(dirPath, entry);
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;
      const ext = path.extname(entry).toLowerCase();
      if (!VIDEO_EXTS.has(ext)) continue;

      rows.push({
        relativePath: path.join(dir, entry),
        filename: entry,
        fullPath,
        folder: dir,
        collection,
        challengeOnly: challenge,
        title: prettifyTitle(entry, dir),
        sizeMB: stat.size / (1024 * 1024),
        durationMinGuess: guessDurationMin(stat.size),
        intensity: guessIntensity(entry, dir),
        bodyFocus: guessBodyFocus(entry, dir),
      });
    }
  }

  return rows;
}

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function main() {
  if (!fs.existsSync(ROOT)) {
    console.error(`❌ Folder not found: ${ROOT}`);
    process.exit(1);
  }

  const rows = scan();

  // Summary
  const standalone = rows.filter((r) => !r.collection && !r.challengeOnly);
  const collections = new Map<string, VideoRow[]>();
  for (const r of rows) {
    if (r.collection) {
      if (!collections.has(r.collection)) collections.set(r.collection, []);
      collections.get(r.collection)!.push(r);
    }
  }
  const challenge = rows.filter((r) => r.challengeOnly);

  const totalGB = rows.reduce((s, r) => s + r.sizeMB, 0) / 1024;

  console.log(`\n📊 Found ${rows.length} videos — ${totalGB.toFixed(1)} GB total\n`);

  console.log(`## Standalone workouts (${standalone.length})`);
  for (const r of standalone) {
    console.log(`  • ${r.title.padEnd(50)} ${r.sizeMB.toFixed(0).padStart(5)} MB  ~${r.durationMinGuess}min`);
  }

  console.log();
  for (const [name, list] of collections) {
    console.log(`## Collection: ${name} (${list.length})`);
    for (const r of list.slice(0, 10)) {
      console.log(`  • ${r.title.padEnd(50)} ${r.sizeMB.toFixed(0).padStart(5)} MB`);
    }
    if (list.length > 10) console.log(`  ... and ${list.length - 10} more`);
    console.log();
  }

  if (challenge.length) {
    console.log(`## 45-Day Challenge (${challenge.length}) — challengeOnly, NOT on /workouts`);
    for (const r of challenge) {
      console.log(`  • ${r.title.padEnd(50)} ${r.sizeMB.toFixed(0).padStart(5)} MB`);
    }
    console.log();
  }

  // Write CSV
  const csvPath = path.join(ROOT, "_import.csv");
  const header = [
    "relativePath", "title", "collection", "challengeOnly",
    "durationMin", "intensity", "bodyFocus", "sizeMB",
  ].join(",");
  const lines = rows.map((r) =>
    [
      csvEscape(r.relativePath),
      csvEscape(r.title),
      csvEscape(r.collection ?? ""),
      String(r.challengeOnly),
      String(r.durationMinGuess),
      r.intensity,
      csvEscape(r.bodyFocus.join("|")),
      r.sizeMB.toFixed(0),
    ].join(",")
  );
  fs.writeFileSync(csvPath, [header, ...lines].join("\n"));

  console.log(`\n📝 CSV written to:\n   ${csvPath}`);
  console.log(`\nEdit the CSV if you want to fix any titles, then run:`);
  console.log(`   npx tsx scripts/upload-all-workouts.ts`);
}

main();
