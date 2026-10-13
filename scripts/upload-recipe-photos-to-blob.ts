/**
 * Uploads all /public/recipes/*.jpg to Vercel Blob and updates each recipe's
 * photoUrl in Supabase to the Blob CDN URL.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { put } from "@vercel/blob";
import { db, recipes } from "@/lib/db";
import { eq } from "drizzle-orm";

const PHOTOS_DIR = path.resolve(__dirname, "..", "public", "recipes");

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN not set in .env.local");
  }

  const files = fs.readdirSync(PHOTOS_DIR).filter((f) => f.endsWith(".jpg"));
  console.log(`Uploading ${files.length} photos to Vercel Blob...\n`);

  let uploaded = 0;
  for (const filename of files) {
    const slug = path.parse(filename).name;
    const filePath = path.join(PHOTOS_DIR, filename);
    const buffer = fs.readFileSync(filePath);

    const blob = await put(`recipes/${filename}`, buffer, {
      access: "public",
      contentType: "image/jpeg",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    // Update DB
    await db
      .update(recipes)
      .set({ photoUrl: blob.url })
      .where(eq(recipes.slug, slug));

    const sizeKb = (buffer.length / 1024).toFixed(0);
    console.log(`  ✓ ${slug.padEnd(45)} ${sizeKb} KB → ${blob.url.slice(0, 70)}…`);
    uploaded++;
  }

  console.log(`\n✅ Uploaded ${uploaded} photos to Blob and updated DB.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
