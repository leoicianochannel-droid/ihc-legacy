import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  await sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS reminder_time text
  `;
  console.log("✓ added reminder_time to users");
  await sql.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
