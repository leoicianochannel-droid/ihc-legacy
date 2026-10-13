import { config } from "dotenv";
config({ path: ".env.local" });
import { db, workouts } from "@/lib/db";
import { desc } from "drizzle-orm";

async function main() {
  const list = await db.select().from(workouts).orderBy(desc(workouts.createdAt));
  console.log(`Total workouts: ${list.length}\n`);
  for (const w of list) {
    console.log(
      `${w.title.padEnd(30)} | uid: ${(w.cfStreamUid ?? "—").slice(0, 16).padEnd(16)} | status: ${(w.cfStreamStatus ?? "—").padEnd(10)} | code: ${(w.cfCustomerCode ?? "—").padEnd(18)} | challengeOnly: ${w.challengeOnly}`
    );
  }
}

main().catch(console.error).finally(() => process.exit(0));
