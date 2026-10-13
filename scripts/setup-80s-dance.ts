/**
 * One-shot script to upload the 80s Dance standalone workout.
 * Run with:  npx tsx scripts/setup-80s-dance.ts
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

const DESKTOP = "/Users/ashleybintner/Desktop/80s dance";

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
    max: 3,
  });
  return drizzle(client, { schema });
}

const db = buildDb();

function uploadViaCurl(filePath: string, uploadUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const mb = (fs.statSync(filePath).size / 1024 / 1024).toFixed(0);
    console.log(`  ⬆  Uploading video (${mb} MB)…`);
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
      if (code === 0) { console.log("  ✓  Video uploaded to Mux"); resolve(); }
      else reject(new Error(`curl failed (code ${code}): ${stderr}`));
    });
  });
}

async function main() {
  const existing = await db
    .select({ id: schema.workouts.id })
    .from(schema.workouts)
    .where(eq(schema.workouts.slug, "80s-dance-workout"))
    .limit(1);
  if (existing.length > 0) {
    console.error("❌ Workout '80s-dance-workout' already exists. Aborting.");
    process.exit(1);
  }

  // 1. Create Mux upload URL
  console.log("\n1/3  Creating Mux upload URL…");
  const upload = await mux.video.uploads.create({
    cors_origin: "*",
    new_asset_settings: {
      playback_policy: ["public"],
      encoding_tier: "smart",
      max_resolution_tier: "1080p",
      mp4_support: "standard",
    },
  });
  console.log("  ✓  Upload URL ready");

  // 2. Upload cover photo to Vercel Blob
  console.log("\n2/3  Uploading cover photo…");
  const coverFile = fs.readdirSync(DESKTOP).find((f) => f.endsWith(".png"));
  if (!coverFile) throw new Error("No PNG found in folder");
  const coverBuffer = fs.readFileSync(path.join(DESKTOP, coverFile));
  const coverBlob = await put(
    "workouts/80s-dance/cover.png",
    coverBuffer,
    { access: "public", token: process.env.BLOB_READ_WRITE_TOKEN! }
  );
  console.log("  ✓  Cover uploaded:", coverBlob.url);

  // 3. Insert workout record
  console.log("\n3/3  Creating workout record and uploading video…");
  await db.insert(schema.workouts).values({
    slug: "80s-dance-workout",
    title: "80's Dance Workout",
    description: "A fun cardio dance workout set to 80s hits. Great for getting your heart rate up and having a blast while you move.",
    durationMin: 14,
    intensity: "beginner" as const,
    bodyFocus: ["cardio", "full-body"],
    equipment: ["hoop"],
    usesHoop: true,
    thumbnailUrl: coverBlob.url,
    muxAssetId: upload.id,
    publishedAt: new Date(),
    sortOrder: 0,
  });
  console.log("  ✓  Workout record created");

  // Upload video (can be slow — Mux webhook handles playback ID when done)
  await uploadViaCurl(path.join(DESKTOP, "video.mp4"), upload.url);

  console.log(`
╔══════════════════════════════════════════════════════╗
║  ✅  80's Dance Workout is live!                     ║
║                                                      ║
║  • Workouts page:  /workouts                         ║
║  • Admin:          /admin/content                    ║
║                                                      ║
║  Video is processing in Mux (~5–10 min).             ║
║  Playback will activate automatically via webhook.   ║
╚══════════════════════════════════════════════════════╝
`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
