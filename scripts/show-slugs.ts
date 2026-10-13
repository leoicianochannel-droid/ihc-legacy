import { config } from "dotenv";
config({ path: ".env.local" });
import { db, workouts } from "@/lib/db";

async function main() {
  const all = await db.select().from(workouts);
  for (const w of all) {
    console.log(`${w.slug.padEnd(35)} | ${w.title}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
