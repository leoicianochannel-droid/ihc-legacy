/**
 * Upload pre-generated PDFs from public/challenge-resources/<slug>/ into
 * Vercel Blob and register them in the challenge_resources table.
 *
 * Usage: tsx --env-file=.env.local scripts/upload-challenge-resources.ts <challenge-slug>
 *
 * If the slug is omitted, the script tries to auto-pick a 45-day challenge.
 * Idempotent on title — skips files already registered for that challenge with
 * the same title.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { put } from "@vercel/blob";
import { db, challenges, challengeResources } from "../lib/db";
import { and, asc, desc, eq } from "drizzle-orm";

type Resource = {
  filename: string;
  title: string;
  description: string;
};

const RESOURCES: Resource[] = [
  {
    filename: "45-day-tracker.pdf",
    title: "45-Day Challenge Tracker",
    description:
      "Printable tracker — 45 daily check-off circles, weekly measurement grid, and your why.",
  },
  {
    filename: "hoop-form-cheat-sheet.pdf",
    title: "Hoop Form Cheat Sheet",
    description:
      "One-page beginner guide: stance, hip movement, common mistakes, 3-minute warm-up.",
  },
  {
    filename: "weekly-meal-prep-planner.pdf",
    title: "Weekly Meal Prep Planner",
    description:
      "Fillable weekly planner — workouts, meals, hydration, grocery list, reflection prompts.",
  },
];

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN is not set");
    process.exit(1);
  }

  const argSlug = process.argv[2];
  let challenge: { id: string; slug: string; title: string } | undefined;

  if (argSlug) {
    const [c] = await db
      .select({ id: challenges.id, slug: challenges.slug, title: challenges.title })
      .from(challenges)
      .where(eq(challenges.slug, argSlug))
      .limit(1);
    challenge = c;
  } else {
    // Auto-pick: prefer durationDays === 45, otherwise newest active
    const all = await db
      .select({
        id: challenges.id,
        slug: challenges.slug,
        title: challenges.title,
        durationDays: challenges.durationDays,
        isActive: challenges.isActive,
        createdAt: challenges.createdAt,
      })
      .from(challenges)
      .orderBy(desc(challenges.createdAt));
    challenge =
      all.find((c) => c.durationDays === 45) ??
      all.find((c) => c.isActive) ??
      all[0];
  }

  if (!challenge) {
    console.error("No challenge found. Run admin → New challenge first, or pass a valid slug.");
    process.exit(2);
  }

  console.log(`→ Target challenge: ${challenge.title} (${challenge.slug})`);

  const localDir = join(
    process.cwd(),
    "public",
    "challenge-resources",
    "45-day"
  );

  // Find the highest existing sortOrder so new ones append cleanly.
  const [maxRow] = await db
    .select({ sortOrder: challengeResources.sortOrder })
    .from(challengeResources)
    .where(eq(challengeResources.challengeId, challenge.id))
    .orderBy(desc(challengeResources.sortOrder))
    .limit(1);
  let nextSort = (maxRow?.sortOrder ?? 0) + 10;

  for (const res of RESOURCES) {
    // Skip if a resource with this title already exists on this challenge
    const [existing] = await db
      .select({ id: challengeResources.id })
      .from(challengeResources)
      .where(
        and(
          eq(challengeResources.challengeId, challenge.id),
          eq(challengeResources.title, res.title)
        )
      )
      .limit(1);
    if (existing) {
      console.log(`  ↷ skip "${res.title}" — already exists`);
      continue;
    }

    const filepath = join(localDir, res.filename);
    const buf = await readFile(filepath);
    const key = `challenges/${challenge.slug}/${Date.now()}-${res.filename}`;
    const blob = await put(key, buf, {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: false,
    });

    await db.insert(challengeResources).values({
      challengeId: challenge.id,
      title: res.title,
      description: res.description,
      fileUrl: blob.url,
      fileType: "pdf",
      fileName: res.filename,
      fileSize: buf.byteLength,
      sortOrder: nextSort,
    });

    console.log(`  ✓ uploaded "${res.title}" → ${blob.url}`);
    nextSort += 10;
  }

  // Show final state
  const all = await db
    .select()
    .from(challengeResources)
    .where(eq(challengeResources.challengeId, challenge.id))
    .orderBy(asc(challengeResources.sortOrder));
  console.log(`\nResources on "${challenge.title}" now: ${all.length}`);
  for (const r of all) console.log(`  · ${r.title} (${r.fileType}, ${r.fileSize} B)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
