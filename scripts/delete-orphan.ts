import { config } from "dotenv";
config({ path: ".env.local" });
import { db, workouts } from "@/lib/db";
import { isNull } from "drizzle-orm";

async function main() {
  const res = await db
    .delete(workouts)
    .where(isNull(workouts.muxAssetId))
    .returning();
  console.log(
    "Deleted orphan workouts (no Mux asset id):",
    res.map((w) => w.title)
  );
}

main().catch(console.error).finally(() => process.exit(0));
