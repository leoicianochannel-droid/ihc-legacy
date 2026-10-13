/**
 * Upload the 30-day challenge videos from ~/Desktop/Infinity to Cloudflare
 * Stream, create one workout row per video, and wire 30 challenge_days into
 * a "The Infinity 30-Day Challenge" challenge record.
 *
 * Resumable: re-running picks up where the last run left off by checking for
 * existing challenge_days rows (challengeId, dayNumber) with a workoutId.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/upload-30-day-challenge.ts
 *   npx tsx --env-file=.env.local scripts/upload-30-day-challenge.ts --dry-run
 */
import fs from "fs";
import path from "path";
import os from "os";
import * as tus from "tus-js-client";
import { db, workouts, challenges, challengeDays } from "../lib/db";
import { and, eq } from "drizzle-orm";
import { getVideo, customerCodeFromPlayback } from "../lib/cloudflare-stream";
import { slugify } from "../lib/utils";

const FOLDER = path.join(os.homedir(), "Desktop", "Infinity");
const CHALLENGE_SLUG = "30-day-challenge";
const TOTAL_DAYS = 30;
const DRY_RUN = process.argv.includes("--dry-run");
// --day=N → only upload that single day. Used as a smoke test.
const SINGLE_DAY_ARG = process.argv.find((a) => a.startsWith("--day="));
const SINGLE_DAY = SINGLE_DAY_ARG ? parseInt(SINGLE_DAY_ARG.split("=")[1], 10) : null;

async function ensureChallenge() {
  const [existing] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.slug, CHALLENGE_SLUG))
    .limit(1);
  if (existing) {
    console.log(`✓ Challenge "${existing.title}" already exists`);
    return existing;
  }

  if (DRY_RUN) {
    console.log(`[dry-run] Would create challenge: ${CHALLENGE_SLUG}`);
    return null;
  }

  const [created] = await db
    .insert(challenges)
    .values({
      slug: CHALLENGE_SLUG,
      title: "The Infinity 30-Day Challenge",
      subtitle: "30 days. One new workout every day. Show up for yourself.",
      description:
        "A daily 30-minute hooping practice designed for beginners. Each day unlocks a new workout — repeat it, build the rhythm, and feel your core change. Miss a day? Your freeze tokens have your back.",
      durationDays: TOTAL_DAYS,
      isRolling: true,
      isActive: true,
      rewardDescription: null,
    })
    .returning();
  console.log(`✓ Created challenge: ${created.title}`);
  return created;
}

/**
 * Upload a single video file to Cloudflare Stream using TUS resumable.
 *
 * Uses the proper /stream endpoint (not /stream/direct_upload — that endpoint
 * is for one-shot multipart POSTs, not TUS). Auth via Bearer token from our
 * env var since this is server-side. Cloudflare returns the video uid in the
 * `Stream-Media-Id` response header which we capture via `onAfterResponse`.
 */
async function uploadFile(
  filePath: string,
  label: string,
  meta: { name: string }
): Promise<{ uid: string }> {
  const stats = fs.statSync(filePath);
  const stream = fs.createReadStream(filePath);

  const accountId = process.env.CF_STREAM_ACCOUNT_ID;
  const apiToken = process.env.CF_STREAM_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error("CF_STREAM_ACCOUNT_ID / CF_STREAM_API_TOKEN missing");
  }

  return new Promise<{ uid: string }>((resolve, reject) => {
    let videoUid = "";
    const upload = new tus.Upload(stream as unknown as Blob, {
      endpoint: `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`,
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      uploadSize: stats.size,
      // Cloudflare requires chunks ≥ 5 MB (except the final chunk). 50 MB is
      // their recommended sweet spot — fewer round-trips, still resumable.
      chunkSize: 50 * 1024 * 1024,
      retryDelays: [0, 2000, 5000, 10_000, 20_000],
      metadata: {
        name: meta.name,
      },
      onAfterResponse: (_req, res) => {
        const id = res.getHeader("stream-media-id");
        if (id) videoUid = id;
      },
      onError: (err) => reject(err),
      onProgress: (bytesUploaded, bytesTotal) => {
        const pct = ((bytesUploaded / bytesTotal) * 100).toFixed(0);
        const mb = (bytesUploaded / 1024 / 1024).toFixed(0);
        const totalMb = (bytesTotal / 1024 / 1024).toFixed(0);
        process.stdout.write(`\r  ${label}: ${pct}% (${mb}/${totalMb} MB)   `);
      },
      onSuccess: () => {
        process.stdout.write("\n");
        if (!videoUid) {
          reject(new Error("Upload finished but no Stream-Media-Id header received"));
          return;
        }
        resolve({ uid: videoUid });
      },
    });
    upload.start();
  });
}

/** Poll Cloudflare Stream until the video has encoded enough to extract a customer code. */
async function waitForCustomerCode(uid: string, maxSeconds = 60): Promise<string | null> {
  const start = Date.now();
  while ((Date.now() - start) / 1000 < maxSeconds) {
    const v = await getVideo(uid);
    if (v?.playback?.hls) {
      return customerCodeFromPlayback(v.playback.hls);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
}

async function uploadOneDay(
  dayNumber: number,
  challengeId: string,
): Promise<{ skipped: boolean; reason?: string }> {
  const filename = `${dayNumber}.mp4`;
  const filePath = path.join(FOLDER, filename);

  if (!fs.existsSync(filePath)) {
    return { skipped: true, reason: `missing file ${filename}` };
  }

  // Already done? Check for a challenge_day row with a linked workoutId.
  const [existingDay] = await db
    .select()
    .from(challengeDays)
    .where(
      and(eq(challengeDays.challengeId, challengeId), eq(challengeDays.dayNumber, dayNumber))
    )
    .limit(1);

  if (existingDay?.workoutId) {
    return { skipped: true, reason: "already uploaded" };
  }

  const title = `30-Day Challenge · Day ${dayNumber}`;
  console.log(`\nDay ${dayNumber}/${TOTAL_DAYS} — ${filename}`);

  if (DRY_RUN) {
    console.log(`  [dry-run] would upload to Cloudflare Stream + create workout + challenge_day`);
    return { skipped: false };
  }

  // Upload via TUS — Cloudflare returns the video uid in the response header
  console.log(`  ↥ uploading to Stream via TUS…`);
  const { uid } = await uploadFile(filePath, `Day ${dayNumber}`, { name: title });
  console.log(`  ✓ uploaded (uid: ${uid.slice(0, 12)}…)`);

  // Poll for a playback URL so we can extract the customer code
  console.log(`  ⏳ waiting for encoding to expose customer code…`);
  const customerCode = await waitForCustomerCode(uid);
  if (customerCode) {
    console.log(`  ✓ customer code: ${customerCode}`);
  } else {
    console.log(`  ⚠ customer code not available yet — will be derived on first playback`);
  }

  // 4. Insert workout row
  const slug = slugify(title) + "-" + Math.random().toString(36).slice(2, 6);
  const [workout] = await db
    .insert(workouts)
    .values({
      slug,
      title,
      description: `Day ${dayNumber} of the Infinity 30-Day Challenge.`,
      durationMin: 30,
      intensity: "beginner",
      bodyFocus: ["core"],
      equipment: ["hoop"],
      usesHoop: true,
      cfStreamUid: uid,
      cfCustomerCode: customerCode,
      challengeOnly: true,
      publishedAt: new Date(),
      sortOrder: dayNumber,
    })
    .returning();

  // 5. Wire it into the challenge — either insert a new day or update existing
  if (existingDay) {
    await db
      .update(challengeDays)
      .set({ workoutId: workout.id })
      .where(eq(challengeDays.id, existingDay.id));
  } else {
    await db.insert(challengeDays).values({
      challengeId,
      dayNumber,
      title: `Day ${dayNumber}`,
      workoutId: workout.id,
    });
  }

  console.log(`  ✓ Day ${dayNumber} wired up`);
  return { skipped: false };
}

async function main() {
  console.log(`\n${DRY_RUN ? "[DRY RUN] " : ""}Importing 30-Day Challenge from ${FOLDER}\n`);

  if (!fs.existsSync(FOLDER)) {
    console.error(`❌ Folder not found: ${FOLDER}`);
    process.exit(1);
  }

  // Check for missing files BEFORE we start uploading anything
  const missing: number[] = [];
  for (let d = 1; d <= TOTAL_DAYS; d++) {
    if (!fs.existsSync(path.join(FOLDER, `${d}.mp4`))) missing.push(d);
  }
  if (missing.length > 0) {
    console.error(`❌ Missing ${missing.length} video(s): ${missing.map((m) => `${m}.mp4`).join(", ")}`);
    console.error(`   Add them to ${FOLDER} and re-run.`);
    process.exit(2);
  }
  console.log(`✓ All 30 video files present\n`);

  const challenge = await ensureChallenge();
  if (!challenge) {
    console.log("[dry-run] complete");
    process.exit(0);
  }

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  const dayRange = SINGLE_DAY
    ? [SINGLE_DAY]
    : Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1);
  if (SINGLE_DAY) {
    console.log(`\n[single-day mode] Only uploading Day ${SINGLE_DAY}\n`);
  }
  for (const day of dayRange) {
    try {
      const res = await uploadOneDay(day, challenge.id);
      if (res.skipped) {
        console.log(`Day ${day}: ↷ skipped (${res.reason})`);
        skipped++;
      } else {
        uploaded++;
      }
    } catch (err) {
      console.error(`Day ${day}: ✗ ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(
    `\n✅ Done. Uploaded: ${uploaded} · Skipped: ${skipped} · Failed: ${failed}`
  );
  console.log(`\nVisit /challenges/${CHALLENGE_SLUG} to see the result.`);
  console.log(
    "Note: Cloudflare encodes each video for 1-3 minutes after upload. Thumbnails appear once encoding finishes."
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
