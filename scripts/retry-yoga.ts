/**
 * One-off: delete the failed YogawithHaza asset and re-upload it with a
 * higher maxDurationSeconds (3 hours, since it's likely a 60+ min class).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import os from "os";
import { db, workouts } from "@/lib/db";
import { eq } from "drizzle-orm";
import * as tus from "tus-js-client";

const ACCOUNT_ID = process.env.CF_STREAM_ACCOUNT_ID!;
const API_TOKEN = process.env.CF_STREAM_API_TOKEN!;
const VIDEO_PATH = path.join(
  os.homedir(),
  "Desktop",
  "infinity-hoop-workouts",
  "YogawithHaza(Instructor).mp4"
);

async function main() {
  console.log("1) Removing failed CF asset + DB record...");
  // Delete the failed asset on CF
  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream/8acff9d55860db62d89b8675e752fbe3`,
    { method: "DELETE", headers: { Authorization: `Bearer ${API_TOKEN}` } }
  );
  // Delete the workout row so the upload script doesn't skip it
  await db.delete(workouts).where(eq(workouts.cfStreamUid, "8acff9d55860db62d89b8675e752fbe3"));

  if (!fs.existsSync(VIDEO_PATH)) {
    console.error(`File not found: ${VIDEO_PATH}`);
    process.exit(1);
  }

  console.log("2) Re-uploading via TUS with maxDurationSeconds=10800 (3 hours)...");
  const fileSize = fs.statSync(VIDEO_PATH).size;
  console.log(`   Size: ${(fileSize / (1024 * 1024)).toFixed(0)} MB`);

  await new Promise<void>((resolve, reject) => {
    const file = fs.createReadStream(VIDEO_PATH);
    let resolvedUid: string | null = null;
    let last = 0;

    const upload = new tus.Upload(file, {
      endpoint: `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream`,
      headers: { Authorization: `Bearer ${API_TOKEN}` },
      uploadSize: fileSize,
      chunkSize: 50 * 1024 * 1024,
      retryDelays: [0, 3000, 6000, 10000],
      metadata: {
        name: "YogawithHaza (Instructor)",
        maxDurationSeconds: "10800",
      },
      onError: (err) => reject(err),
      onProgress: (b, total) => {
        const pct = Math.floor((b / total) * 100);
        if (pct >= last + 25 && pct < 100) {
          console.log(`   ... ${pct}%`);
          last = pct;
        }
      },
      onAfterResponse: (req, res) => {
        const uid = res.getHeader("stream-media-id");
        if (uid && !resolvedUid) resolvedUid = String(uid);
      },
      onSuccess: () => {
        if (resolvedUid) {
          console.log(`   ✓ Uploaded — uid: ${resolvedUid}`);
          // Insert workout record
          db.insert(workouts)
            .values({
              slug: "yoga-with-haza-013-retry",
              title: "Yoga with Haza (Instructor)",
              durationMin: 60,
              intensity: "beginner",
              bodyFocus: ["flexibility"],
              equipment: ["mat"],
              usesHoop: false,
              collection: null,
              challengeOnly: false,
              cfStreamUid: resolvedUid,
              cfStreamStatus: "queued",
              cfCustomerCode: "twol2uc11by8twa7",
              publishedAt: new Date(),
            })
            .then(() => {
              console.log("   ✓ DB record created");
              resolve();
            })
            .catch(reject);
        } else {
          reject(new Error("No UID returned"));
        }
      },
    });

    upload.start();
  });

  console.log("\n✅ Done. Cloudflare is encoding now (~2 min).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
