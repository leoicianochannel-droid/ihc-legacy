/**
 * Applies thumbnail images to workouts in the database.
 * Thumbnails live in public/thumbnails/ and are served as static assets.
 *
 * Run with:
 *   DATABASE_URL="..." npx tsx scripts/apply-thumbnails.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { db, workouts } from "@/lib/db";
import { eq } from "drizzle-orm";

// Maps workout slug → public thumbnail path
const SLUG_TO_THUMBNAIL: Record<string, string> = {
  // Main workouts
  "beginners-confidence-flow-001":                       "/thumbnails/Beginners Confidence Flow.jpg",
  "cardio-dance-moves-infinity-hoop-workout-remix-002":  "/thumbnails/Cardio Dance Moves.jpg",
  "cardio-queen-x-confidence-routine-003":               "/thumbnails/Cardio Queen and Confidence.jpg",
  "chair-cardio-and-infinity-hoop-004":                  "/thumbnails/Glutes Activation Chair Workout.jpeg",
  "cooking-demo-005":                                    "/thumbnails/Live Cooking Demo.jpg",
  "holiday-survival-stretch-and-de-stress-flow-006":     "/thumbnails/Stretch and Flow.jpg",
  "infinity-hoop-advanced-session-008":                  "/thumbnails/Advanced Hoop Workout.jpeg",
  "self-love-training-video-009":                        "/thumbnails/Self Esteem Session.jpg",
  "spring-slim-down-010":                                "/thumbnails/Spring Slim Down.jpg",
  "thanksgiving-session-011":                            "/thumbnails/Thanksgiving Burn.jpg",
  "valentine-s-day-session-012":                         "/thumbnails/VDay Workout.jpg",
  "yoga-with-haza-013-retry":                            "/thumbnails/Live Yoga Session.jpg",

  // 30-Day Challenge days (all share the same thumbnail)
  "30-day-challenge-day-1-fb3l":   "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-2-tyql":   "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-3-pqkc":   "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-4-vwzw":   "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-5-vx8s":   "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-6-9mwe":   "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-7-6bgh":   "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-8-s4p2":   "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-9-4yd6":   "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-10-ro3b":  "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-11-moqe":  "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-12-ny9p":  "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-13-brb9":  "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-14-jtc3":  "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-15-2jqu":  "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-16-2nda":  "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-17-fqmf":  "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-18-dj8i":  "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-19-nw6t":  "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-20-y2ys":  "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-21-vx7w":  "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-22-g65y":  "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-23-sfht":  "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-24-vgne":  "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-25-e4wp":  "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-26-vctf":  "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-27-2qpa":  "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-28-vsh5":  "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-29-ihks":  "/thumbnails/30 Day Challenge.jpeg",
  "30-day-challenge-day-30-jxv6":  "/thumbnails/30 Day Challenge.jpeg",

  // Pre-Hoop 2-Week Program (weeks 1–6)
  "week-1-054": "/thumbnails/Pre Hoop Two Week Challenge.jpeg",
  "week-2-055": "/thumbnails/Pre Hoop Two Week Challenge.jpeg",
  "week-3-056": "/thumbnails/Pre Hoop Two Week Challenge.jpeg",
  "week-4-057": "/thumbnails/Pre Hoop Two Week Challenge.jpeg",
  "week-5-058": "/thumbnails/Pre Hoop Two Week Challenge.jpeg",
  "week-6-059": "/thumbnails/Pre Hoop Two Week Challenge.jpeg",
};

async function main() {
  let updated = 0;
  let skipped = 0;

  for (const [slug, thumbnailUrl] of Object.entries(SLUG_TO_THUMBNAIL)) {
    const result = await db
      .update(workouts)
      .set({ thumbnailUrl })
      .where(eq(workouts.slug, slug))
      .returning({ slug: workouts.slug });

    if (result.length > 0) {
      console.log(`✓ ${slug}`);
      updated++;
    } else {
      console.log(`✗ NOT FOUND: ${slug}`);
      skipped++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, not found: ${skipped}`);
}

main().catch(console.error).finally(() => process.exit(0));
