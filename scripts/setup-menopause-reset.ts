/**
 * One-shot script to create the Menopause Reset 6-week program.
 *
 * Run with:  npx tsx scripts/setup-menopause-reset.ts
 *
 * What it does:
 *  1. Creates 6 Mux direct-upload URLs
 *  2. Uploads Week 1–6 MP4s in parallel directly to Mux
 *  3. Uploads the cover photo to Vercel Blob
 *  4. Inserts 6 workout rows (muxAssetId = upload id; webhook fills in playbackId later)
 *  5. Inserts the program row
 *  6. Inserts 42 program_days + 42 program_day_exercises (7 days × 6 weeks)
 */

import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local"), override: true });
config({ path: path.resolve(process.cwd(), ".env.local.vercel"), override: false });

import { spawn } from "child_process";
import fs from "fs";
import Mux from "@mux/mux-node";
import { put } from "@vercel/blob";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/db/schema";
import { eq } from "drizzle-orm";

// ── Config ─────────────────────────────────────────────────────────────────

const DESKTOP = "/Users/ashleybintner/Desktop/menopause reset";

const WEEKS = [
  { num: 1, duration: 28 },
  { num: 2, duration: 26 },
  { num: 3, duration: 26 },
  { num: 4, duration: 26 },
  { num: 5, duration: 26 },
  { num: 6, duration: 26 },
];

// ── Clients ─────────────────────────────────────────────────────────────────

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

function buildDb() {
  const raw = process.env.DATABASE_URL!;
  const u = new URL(raw);
  const ssl: "require" | false =
    u.hostname.includes("supabase") || u.hostname.includes("neon") ? "require" : false;
  const client = postgres({
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    database: u.pathname.replace(/^\//, "") || "postgres",
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl,
    prepare: false,
    max: 5,
  });
  return drizzle(client, { schema });
}

const db = buildDb();

// ── Helpers ──────────────────────────────────────────────────────────────────

function uploadViaCurl(filePath: string, uploadUrl: string, label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`  ⬆  Uploading ${label} (${(fs.statSync(filePath).size / 1024 / 1024).toFixed(0)} MB)…`);
    const proc = spawn("curl", [
      "--silent", "--show-error",
      "-X", "PUT",
      "-T", filePath,
      "-H", "Content-Type: video/mp4",
      uploadUrl,
    ]);
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) {
        console.log(`  ✓  ${label} uploaded to Mux`);
        resolve();
      } else {
        reject(new Error(`curl failed for ${label} (code ${code}): ${stderr}`));
      }
    });
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Sanity check: don't create duplicates
  const existing = await db
    .select({ id: schema.programs.id })
    .from(schema.programs)
    .where(eq(schema.programs.slug, "menopause-reset"))
    .limit(1);
  if (existing.length > 0) {
    console.error("❌ Program 'menopause-reset' already exists. Aborting.");
    process.exit(1);
  }

  // ── Step 1: Create Mux direct-upload URLs ──────────────────────────────────
  console.log("\n1/5  Creating Mux direct-upload URLs…");
  const muxUploads = await Promise.all(
    WEEKS.map(() =>
      mux.video.uploads.create({
        cors_origin: "*",
        new_asset_settings: {
          playback_policy: ["public"],
          encoding_tier: "smart",
          max_resolution_tier: "1080p",
          mp4_support: "standard",
        },
      })
    )
  );
  console.log("  ✓  Upload URLs ready");

  // ── Step 2: Upload cover photo to Vercel Blob ──────────────────────────────
  console.log("\n2/5  Uploading cover photo…");
  const coverBuffer = fs.readFileSync(path.join(DESKTOP, "menopause reset cover photo.png"));
  const coverBlob = await put(
    "programs/menopause-reset/cover.png",
    coverBuffer,
    {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN!,
    }
  );
  const coverUrl = coverBlob.url;
  console.log("  ✓  Cover photo uploaded:", coverUrl);

  // ── Step 3: Insert workout rows ────────────────────────────────────────────
  console.log("\n3/5  Creating workout records…");
  const workoutRows = await db
    .insert(schema.workouts)
    .values(
      WEEKS.map((w, i) => ({
        slug: `menopause-reset-week-${w.num}`,
        title: `Menopause Reset – Week ${w.num}`,
        description: `Week ${w.num} of the 6-week Menopause Reset program.`,
        durationMin: w.duration,
        intensity: "intermediate" as const,
        bodyFocus: ["full-body"],
        equipment: ["hoop"],
        usesHoop: true,
        collection: "Menopause Reset",
        muxAssetId: muxUploads[i].id,   // upload id — webhook swaps to real asset id
        publishedAt: new Date(),
        sortOrder: w.num,
      }))
    )
    .returning({ id: schema.workouts.id });
  console.log("  ✓  6 workouts inserted");

  // ── Step 4: Create program + 42 days ──────────────────────────────────────
  console.log("\n4/5  Creating program and 42 program days…");
  const [program] = await db
    .insert(schema.programs)
    .values({
      slug: "menopause-reset",
      title: "Menopause Reset",
      subtitle: "6 weeks to reset, restore & reclaim your energy",
      description:
        "A 6-week guided program designed for women navigating menopause. Each week builds on the last — same workout repeated daily so your body can adapt, strengthen, and find its rhythm.",
      coverUrl,
      durationDays: 42,
      isActive: true,
      sortOrder: 1,
    })
    .returning({ id: schema.programs.id });

  for (let week = 1; week <= 6; week++) {
    const workoutId = workoutRows[week - 1].id;
    for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek++) {
      const dayNumber = (week - 1) * 7 + dayOfWeek;
      const [programDay] = await db
        .insert(schema.programDays)
        .values({
          programId: program.id,
          dayNumber,
          title: `Week ${week}, Day ${dayOfWeek}`,
          isRestDay: false,
        })
        .returning({ id: schema.programDays.id });

      await db.insert(schema.programDayExercises).values({
        programDayId: programDay.id,
        workoutId,
        label: `Menopause Reset – Week ${week}`,
        sortOrder: 0,
      });
    }
  }
  console.log("  ✓  Program + 42 days created");

  // ── Step 5: Upload all 6 videos in parallel ────────────────────────────────
  console.log("\n5/5  Uploading all 6 videos to Mux (this takes a while)…");
  await Promise.all(
    WEEKS.map((w, i) =>
      uploadViaCurl(
        path.join(DESKTOP, `Week ${w.num}.mp4`),
        muxUploads[i].url,
        `Week ${w.num}`
      )
    )
  );

  console.log(`
╔══════════════════════════════════════════════════════╗
║  ✅  Menopause Reset program is live!                ║
║                                                      ║
║  • Program page:  /programs/menopause-reset          ║
║  • Admin:         /admin/content                     ║
║                                                      ║
║  Videos are processing in Mux — playback IDs         ║
║  will be set automatically via webhook once          ║
║  each video finishes encoding (~5–15 min each).      ║
╚══════════════════════════════════════════════════════╝
`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
