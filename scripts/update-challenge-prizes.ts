import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.local.vercel" });

import { db, challenges } from "../lib/db";
import { eq } from "drizzle-orm";

async function main() {
  const prizes = JSON.stringify([
    { category: "Best Non-Scale Victory", amount: 500 },
    { category: "Best Reel, most viral", amount: 500 },
    { category: "Best Transformation Story", amount: 500 },
    { category: "Most inches off the waist", amount: 500 },
  ]);

  const [updated] = await db
    .update(challenges)
    .set({ rewardDescription: prizes })
    .where(eq(challenges.slug, "30-day-challenge"))
    .returning({ id: challenges.id, slug: challenges.slug });

  if (updated) {
    console.log("✅ Updated prize structure for:", updated.slug);
  } else {
    console.log("❌ No challenge found with slug '30-day-challenge'");
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
