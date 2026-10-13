/**
 * Upload public/welcome-tour.mp4 to Cloudflare Stream, then set it as the
 * active welcome video so every new member sees it after onboarding.
 *
 * Run after generate-welcome-video.py has produced the MP4.
 */
import fs from "fs";
import path from "path";
import * as tus from "tus-js-client";
import { getVideo, customerCodeFromPlayback } from "../lib/cloudflare-stream";
// We can't import lib/welcome-video.ts in a standalone tsx script because it
// uses `server-only`. Re-implement the upsert inline against the DB.
import { db, siteSettings } from "../lib/db";
import { sql } from "drizzle-orm";

async function setWelcomeVideo(opts: {
  uid: string;
  customerCode: string | null;
  durationSec: number | null;
}) {
  const pairs: Array<[string, string | null]> = [
    ["welcome_video_uid", opts.uid],
    ["welcome_video_customer_code", opts.customerCode],
    ["welcome_video_duration_sec", opts.durationSec ? String(opts.durationSec) : null],
  ];
  for (const [key, value] of pairs) {
    await db
      .insert(siteSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value, updatedAt: sql`now()` },
      });
  }
}

const VIDEO_PATH = path.join(
  "/Users/ashleybintner/Claude Code/public/welcome-tour.mp4"
);

async function uploadTus(file: string): Promise<string> {
  const accountId = process.env.CF_STREAM_ACCOUNT_ID;
  const apiToken = process.env.CF_STREAM_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error("CF_STREAM_ACCOUNT_ID / CF_STREAM_API_TOKEN missing");
  }

  const stats = fs.statSync(file);
  const stream = fs.createReadStream(file);

  return new Promise<string>((resolve, reject) => {
    let uid = "";
    const upload = new tus.Upload(stream as unknown as Blob, {
      endpoint: `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`,
      headers: { Authorization: `Bearer ${apiToken}` },
      uploadSize: stats.size,
      chunkSize: 50 * 1024 * 1024,
      retryDelays: [0, 2000, 5000, 10_000],
      metadata: { name: "Infinity Hoop — Welcome Tour" },
      onAfterResponse: (_req, res) => {
        const id = res.getHeader("stream-media-id");
        if (id) uid = id;
      },
      onProgress: (b, t) => {
        const pct = ((b / t) * 100).toFixed(0);
        process.stdout.write(`\r  ${pct}%   `);
      },
      onSuccess: () => {
        process.stdout.write("\n");
        if (!uid) reject(new Error("No Stream-Media-Id received"));
        else resolve(uid);
      },
      onError: reject,
    });
    upload.start();
  });
}

async function pollUntilReady(uid: string, maxSec = 120) {
  const start = Date.now();
  while ((Date.now() - start) / 1000 < maxSec) {
    const v = await getVideo(uid);
    if (v?.readyToStream) return v;
    if (v?.playback?.hls) return v; // good enough — playback exists
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
}

async function main() {
  if (!fs.existsSync(VIDEO_PATH)) {
    console.error(`❌ Run scripts/generate-welcome-video.py first.`);
    process.exit(1);
  }

  console.log(`↥ uploading ${path.basename(VIDEO_PATH)} to Cloudflare Stream…`);
  const uid = await uploadTus(VIDEO_PATH);
  console.log(`✓ uploaded (uid: ${uid})`);

  console.log(`⏳ waiting for encoding…`);
  const v = await pollUntilReady(uid);
  const customerCode = v?.playback?.hls
    ? customerCodeFromPlayback(v.playback.hls)
    : null;
  const duration = v?.duration ? Math.round(v.duration) : null;

  console.log(`✓ customer code: ${customerCode ?? "(not yet available)"}`);
  console.log(`✓ duration: ${duration ?? "(unknown)"}s`);

  console.log(`\n⚙ wiring as the active welcome video…`);
  await setWelcomeVideo({ uid, customerCode, durationSec: duration });

  console.log(`\n✅ Welcome video is live for new members.`);
  console.log(`   Admin page: /admin/welcome-video`);
  console.log(`   Member rewatch: /welcome (pink "Watch the welcome tour" button)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
