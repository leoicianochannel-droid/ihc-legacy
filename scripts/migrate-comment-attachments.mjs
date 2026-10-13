import postgres from "postgres";
import { readFileSync } from "fs";

// Read DATABASE_URL from .env.local
const env = readFileSync(".env.local", "utf8");
const match = env.match(/DATABASE_URL="([^"]+)"/);
if (!match) { console.error("DATABASE_URL not found in .env.local"); process.exit(1); }

const sql = postgres(match[1]);
try {
  await sql`ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb`;
  console.log("✓ attachments column added to post_comments");
} catch (e) {
  console.error("Error:", e.message);
  process.exit(1);
} finally {
  await sql.end();
}
