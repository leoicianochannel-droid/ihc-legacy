import { config } from "dotenv";
config({ path: ".env.local" });
import { db, workouts } from "@/lib/db";
import { eq } from "drizzle-orm";

async function main() {
  const r = await db
    .update(workouts)
    .set({ thumbnailUrl: "/thumbnails/Bliss and Burn.jpg" })
    .where(eq(workouts.slug, "infinity-hoop-bliss-and-burn-007"))
    .returning({ slug: workouts.slug });
  console.log(r.length ? "✓ Updated infinity-hoop-bliss-and-burn-007" : "✗ Not found");
}

main().catch(console.error).finally(() => process.exit(0));
