const { config } = require("dotenv");
const path = require("path");
const result = config({ path: path.join(__dirname, "..", ".env.local") });
if (result.error) throw result.error;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not found in .env.local");

const { neon } = require("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

(async () => {
  await sql`ALTER TABLE workouts ADD COLUMN IF NOT EXISTS video_url text`;
  console.log("Column added (or already existed).");

  const [row] = await sql`
    INSERT INTO workouts (
      slug, title, description, instructor, duration_min, intensity,
      body_focus, equipment, uses_hoop, video_url, published_at, sort_order
    ) VALUES (
      'october-ignite',
      'October Ignite',
      'Your 30-minute hoop burn. Halloween energy — high intensity, full body, all fire.',
      'Ashley',
      30,
      'intermediate',
      ARRAY['core','full-body','cardio'],
      ARRAY['hoop'],
      true,
      'https://okntwdbbmyzw9bvc.public.blob.vercel-storage.com/videos/october-ignite-JcWoQAwCUygRqc4UuArgArlHLyRD1I.mp4',
      NOW(),
      0
    )
    ON CONFLICT (slug) DO UPDATE SET
      video_url = EXCLUDED.video_url
    RETURNING id, slug, title
  `;
  console.log("Done:", row);
})().catch(e => { console.error(e.message); process.exit(1); });
