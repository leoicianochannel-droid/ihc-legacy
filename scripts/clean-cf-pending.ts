/**
 * Removes any Cloudflare Stream videos stuck in "pendingupload" state.
 * Those are upload URLs that were created but never received the file
 * (because the file was too big for direct upload). They count toward
 * storage quota but contain no actual video.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID!;
const TOKEN = process.env.CF_API_TOKEN!;

async function main() {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream?per_page=100`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  const json = await res.json();
  const videos = json.result || [];

  let deleted = 0;
  for (const v of videos) {
    const state = v.status?.state;
    if (state === "pendingupload" || state === "error") {
      console.log(`Deleting (${state}): ${v.meta?.name || v.uid}`);
      const del = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream/${v.uid}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${TOKEN}` } }
      );
      if (del.ok) deleted++;
    }
  }

  console.log(`\n✅ Deleted ${deleted} stuck videos.`);

  const usage = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream/storage-usage`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  const u = await usage.json();
  console.log(`Storage now: ${u.result.totalStorageMinutes.toFixed(1)} / ${u.result.totalStorageMinutesLimit} min  (${u.result.videoCount} videos)`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
