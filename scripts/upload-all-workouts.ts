/**
 * Bulk uploads every video from the scan CSV to Cloudflare Stream + creates
 * workout records.
 *
 * For challenge videos (challengeOnly=true), also:
 *   - marks workout as challengeOnly so it doesn't show on /workouts
 *   - links to the 6-week challenge via challenge_days
 *
 * Idempotent: skips videos whose slug already has a cfStreamUid.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import os from "os";
import { parse } from "csv-parse/sync";
import {
  db,
  workouts,
  challenges,
  challengeDays,
  challengeMembers,
  challengeCheckins,
} from "@/lib/db";
import { eq, and } from "drizzle-orm";
import {
  createDirectUpload,
  getVideo,
  customerCodeFromPlayback,
} from "@/lib/cloudflare-stream";
import * as tus from "tus-js-client";
import { slugify } from "@/lib/utils";

const ROOT = path.join(os.homedir(), "Desktop", "infinity-hoop-workouts");
const CSV_PATH = path.join(ROOT, "_import.csv");
const LOG_PATH = "/tmp/workout-upload.log";

type Row = {
  relativePath: string;
  title: string;
  collection: string;
  challengeOnly: string;
  durationMin: string;
  intensity: string;
  bodyFocus: string;
  sizeMB: string;
};

function appendLog(msg: string) {
  fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${msg}\n`);
  console.log(msg);
}

const ACCOUNT_ID = process.env.CF_STREAM_ACCOUNT_ID!;
const API_TOKEN = process.env.CF_STREAM_API_TOKEN!;

/**
 * Uploads a video file to Cloudflare Stream using the TUS protocol (resumable).
 * Works for any file size including the 3+ GB classes. Returns the Stream UID.
 *
 * https://developers.cloudflare.com/stream/uploading-videos/upload-video-file/#upload-with-the-tus-protocol
 */
function uploadFileWithTUS(
  localPath: string,
  meta: { name: string; maxDurationSeconds: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const file = fs.createReadStream(localPath);
    const fileSize = fs.statSync(localPath).size;
    let resolvedUid: string | null = null;
    let lastLoggedPct = 0;

    const upload = new tus.Upload(file, {
      endpoint: `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream`,
      headers: { Authorization: `Bearer ${API_TOKEN}` },
      uploadSize: fileSize,
      chunkSize: 50 * 1024 * 1024, // 50 MB chunks (CF requires multiple of 256 KB; 50MB works)
      retryDelays: [0, 3000, 6000, 10000],
      metadata: {
        name: meta.name,
        maxDurationSeconds: String(meta.maxDurationSeconds),
      },
      onError(err) {
        reject(err);
      },
      onProgress(bytesUploaded, bytesTotal) {
        const pct = Math.floor((bytesUploaded / bytesTotal) * 100);
        if (pct >= lastLoggedPct + 25 && pct < 100) {
          appendLog(`      ... ${pct}%`);
          lastLoggedPct = pct;
        }
      },
      onAfterResponse(req, res) {
        // Cloudflare returns the asset UID in the stream-media-id header on first response
        const uid = res.getHeader("stream-media-id");
        if (uid && !resolvedUid) resolvedUid = String(uid);
      },
      onSuccess() {
        if (resolvedUid) resolve(resolvedUid);
        else reject(new Error("Upload succeeded but no UID returned"));
      },
    });

    upload.start();
  });
}

function extractWeekNumber(title: string): number | null {
  const m = title.match(/\bweek\s*(\d+)\b/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 52 ? n : null;
}

async function restructureChallengeToSixWeeks(challengeId: string) {
  const [c] = await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);
  if (!c) return;
  appendLog("  → Restructuring challenge to 6-week format");

  await db.delete(challengeDays).where(eq(challengeDays.challengeId, challengeId));

  await db
    .update(challenges)
    .set({
      title: c.title.includes("45") ? c.title : "The 45-Day Infinity Challenge",
      subtitle: "6-week transformation program",
      description:
        "Six progressive weeks of workouts, recipes, and check-ins. One new workout unlocks each week — do it as many times as feels right. Finish and you're a different person.",
      durationDays: 42,
    })
    .where(eq(challenges.id, challengeId));

  const members = await db
    .select()
    .from(challengeMembers)
    .where(eq(challengeMembers.challengeId, challengeId));
  for (const m of members) {
    if (m.currentDay > 6) {
      await db.update(challengeMembers).set({ currentDay: 6 }).where(eq(challengeMembers.id, m.id));
    }
    await db
      .delete(challengeCheckins)
      .where(eq(challengeCheckins.challengeMemberId, m.id));
  }
}

async function ensureChallengeDay(
  challengeId: string,
  weekNumber: number,
  workoutId: string,
  title: string
) {
  const existing = await db
    .select()
    .from(challengeDays)
    .where(
      and(
        eq(challengeDays.challengeId, challengeId),
        eq(challengeDays.dayNumber, weekNumber)
      )
    )
    .limit(1);
  if (existing.length) {
    await db
      .update(challengeDays)
      .set({ workoutId, title: `Week ${weekNumber}`, description: title })
      .where(eq(challengeDays.id, existing[0].id));
  } else {
    await db.insert(challengeDays).values({
      challengeId,
      dayNumber: weekNumber,
      title: `Week ${weekNumber}`,
      description: title,
      workoutId,
      reflectionPrompt: "How did this week feel in your body? What changed?",
    });
  }
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ Run 'npx tsx scripts/scan-all-workouts.ts' first.`);
    process.exit(1);
  }

  const allRows = parse(fs.readFileSync(CSV_PATH, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Row[];

  // Optional --limit N to upload only the first N (handy for testing)
  const limitArgIdx = process.argv.indexOf("--limit");
  const limit = limitArgIdx > -1 ? parseInt(process.argv[limitArgIdx + 1], 10) : Infinity;

  // For testing, prefer the smallest videos first so the test is fast
  const sortBySize = process.argv.includes("--smallest-first");
  const rows = sortBySize
    ? [...allRows].sort((a, b) => parseFloat(a.sizeMB) - parseFloat(b.sizeMB)).slice(0, limit)
    : allRows.slice(0, limit);

  const totalMB = rows.reduce((s, r) => s + parseFloat(r.sizeMB), 0);
  appendLog(`\n🚀 Cloudflare Stream upload: ${rows.length} videos, ${(totalMB / 1024).toFixed(1)} GB`);
  appendLog(`    Log: ${LOG_PATH}\n`);

  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.slug, "45-day-challenge"))
    .limit(1);

  if (!challenge) {
    appendLog("⚠️  45-day challenge not found in DB. Challenge videos won't be linked to days.");
  } else {
    await restructureChallengeToSixWeeks(challenge.id);
  }

  let ok = 0;
  let failed = 0;
  const start = Date.now();

  for (const [i, row] of rows.entries()) {
    const fullPath = path.join(ROOT, row.relativePath);
    if (!fs.existsSync(fullPath)) {
      appendLog(`[${i + 1}/${rows.length}] ❌ Missing file: ${row.relativePath}`);
      failed++;
      continue;
    }

    const slug = slugify(row.title) + "-" + (i + 1).toString().padStart(3, "0");

    const [existing] = await db.select().from(workouts).where(eq(workouts.slug, slug)).limit(1);
    if (existing?.cfStreamUid) {
      appendLog(`[${i + 1}/${rows.length}] ⏭  ${row.title} — already uploaded, skipping`);
      ok++;
      continue;
    }

    const sizeMB = parseFloat(row.sizeMB);
    const challengeOnly = row.challengeOnly === "true";
    const bodyFocus = row.bodyFocus.split("|").map((s) => s.trim()).filter(Boolean);
    const intensity = (["beginner", "intermediate", "advanced"].includes(row.intensity)
      ? row.intensity
      : "intermediate") as "beginner" | "intermediate" | "advanced";

    appendLog(`[${i + 1}/${rows.length}] ${row.title}  (${sizeMB.toFixed(0)} MB)`);

    try {
      // Use TUS resumable protocol — handles any file size, retries chunks on failure.
      // Reserve only 60 min per upload (any class fits) so we don't burn quota on slack.
      const t0 = Date.now();
      const cfUid = await uploadFileWithTUS(fullPath, {
        name: row.title,
        maxDurationSeconds: 3600,
      });
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      const mbps = ((sizeMB * 8) / parseFloat(secs)).toFixed(1);
      appendLog(`    ✓ uploaded in ${secs}s (${mbps} Mbps) — uid: ${cfUid.slice(0, 12)}...`);

      // Try to fetch the video metadata to grab customer subdomain code
      let customerCode: string | null = null;
      try {
        const v = await getVideo(cfUid);
        customerCode = customerCodeFromPlayback(v?.playback?.hls);
      } catch {
        // Probably not yet processed enough — webhook/poll will fill in later
      }

      const [w] = await db
        .insert(workouts)
        .values({
          slug,
          title: row.title,
          description: null,
          durationMin: parseInt(row.durationMin, 10) || 25,
          intensity,
          bodyFocus,
          equipment: ["hoop"],
          usesHoop: true,
          collection: row.collection || null,
          challengeOnly,
          cfStreamUid: cfUid,
          cfStreamStatus: "queued",
          cfCustomerCode: customerCode,
          publishedAt: new Date(),
          sortOrder: i,
        })
        .returning();

      if (challengeOnly && challenge) {
        const weekNum = extractWeekNumber(row.title);
        if (weekNum) {
          await ensureChallengeDay(challenge.id, weekNum, w.id, row.title);
          appendLog(`    ✓ linked as Week ${weekNum} of challenge`);
        } else {
          appendLog(`    ⚠️ couldn't detect week number in "${row.title}"`);
        }
      }

      ok++;
    } catch (err) {
      appendLog(`    ✗ FAILED: ${(err as Error).message.slice(0, 200)}`);
      failed++;
    }

    const elapsed = (Date.now() - start) / 1000;
    const done = ok + failed;
    const eta = ((rows.length - done) * (elapsed / Math.max(1, done))) / 60;
    appendLog(`    [elapsed ${(elapsed / 60).toFixed(1)}m · ETA ${eta.toFixed(0)}m remaining]`);
  }

  const totalMin = ((Date.now() - start) / 1000 / 60).toFixed(1);
  appendLog(`\n✅ Done. Uploaded ${ok}/${rows.length} in ${totalMin}m.  Failed: ${failed}`);
  appendLog(`   Cloudflare is encoding each video — they appear on the site as each finishes.`);
}

main()
  .catch((e) => {
    appendLog(`\n💥 Fatal: ${(e as Error).stack}`);
    process.exit(1);
  })
  .finally(() => process.exit(0));
