/** Poll Cloudflare until the welcome video finishes encoding, then update
 *  its duration in site_settings so the modal shows "(N min)". */
import { db, siteSettings } from "../lib/db";
import { eq, sql } from "drizzle-orm";
import { getVideo } from "../lib/cloudflare-stream";

async function main() {
  const [row] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, "welcome_video_uid"))
    .limit(1);
  if (!row?.value) {
    console.error("No welcome_video_uid configured yet.");
    process.exit(1);
  }
  const uid = row.value;
  console.log(`Polling Cloudflare for uid=${uid}…`);

  for (let i = 0; i < 40; i++) {
    const v = await getVideo(uid);
    if (v?.duration && v.duration > 0) {
      const sec = Math.round(v.duration);
      await db
        .insert(siteSettings)
        .values({ key: "welcome_video_duration_sec", value: String(sec) })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: { value: String(sec), updatedAt: sql`now()` },
        });
      console.log(`✓ Duration updated to ${sec}s`);
      process.exit(0);
    }
    process.stdout.write(`  attempt ${i + 1} — still encoding\r`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.error("\nTimed out waiting for encoding. Re-run later.");
  process.exit(2);
}
main().catch((err) => { console.error(err); process.exit(1); });
