"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, challenges, challengeResources } from "@/lib/db";
import { asc, desc, eq } from "drizzle-orm";
import { put, del } from "@vercel/blob";
import { revalidatePath } from "next/cache";

async function assertAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("not authenticated");
  const [me] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (me?.role !== "admin") throw new Error("forbidden");
}

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB — bigger than community attachments because cheat sheets / printable PDFs can be larger
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function classify(mime: string): "pdf" | "image" | "doc" {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  return "doc";
}

export async function uploadResource(challengeSlug: string, formData: FormData) {
  await assertAdmin();

  const [challenge] = await db
    .select({ id: challenges.id, slug: challenges.slug })
    .from(challenges)
    .where(eq(challenges.slug, challengeSlug))
    .limit(1);
  if (!challenge) return { ok: false as const, error: "Challenge not found." };

  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const description = String(formData.get("description") ?? "").trim().slice(0, 1000) || null;

  if (!title) return { ok: false as const, error: "Title is required." };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "Pick a file to upload." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false as const,
      error: `"${file.name}" is too big (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
    };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return {
      ok: false as const,
      error: `"${file.name}" is not a supported type. Use PDF, JPG, PNG, WEBP, or DOC/DOCX.`,
    };
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { ok: false as const, error: "Blob storage is not configured." };
  }

  const ext = file.name.split(".").pop() || "bin";
  const key = `challenges/${challenge.slug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const blob = await put(key, file, {
    access: "public",
    contentType: file.type,
    addRandomSuffix: false,
  });

  // Append at the end of the current sort order
  const [last] = await db
    .select({ sortOrder: challengeResources.sortOrder })
    .from(challengeResources)
    .where(eq(challengeResources.challengeId, challenge.id))
    .orderBy(desc(challengeResources.sortOrder))
    .limit(1);
  const nextSort = (last?.sortOrder ?? 0) + 10;

  await db.insert(challengeResources).values({
    challengeId: challenge.id,
    title,
    description,
    fileUrl: blob.url,
    fileType: classify(file.type),
    fileName: file.name,
    fileSize: file.size,
    sortOrder: nextSort,
  });

  revalidatePath(`/admin/content/challenges/${challengeSlug}/resources`);
  revalidatePath(`/challenges/${challengeSlug}`);
  return { ok: true as const };
}

export async function deleteResource(resourceId: string, challengeSlug: string) {
  await assertAdmin();

  const [r] = await db
    .select()
    .from(challengeResources)
    .where(eq(challengeResources.id, resourceId))
    .limit(1);
  if (!r) return;

  // Best-effort blob cleanup — don't fail the action if the file is already gone.
  try {
    await del(r.fileUrl);
  } catch (err) {
    console.warn("Could not delete blob for resource", resourceId, err);
  }
  await db.delete(challengeResources).where(eq(challengeResources.id, resourceId));

  revalidatePath(`/admin/content/challenges/${challengeSlug}/resources`);
  revalidatePath(`/challenges/${challengeSlug}`);
}

export async function listResources(challengeId: string) {
  return db
    .select()
    .from(challengeResources)
    .where(eq(challengeResources.challengeId, challengeId))
    .orderBy(asc(challengeResources.sortOrder), asc(challengeResources.createdAt));
}
