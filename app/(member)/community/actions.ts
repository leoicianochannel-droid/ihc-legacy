"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, posts, postLikes, postComments, postReactions } from "@/lib/db";
import { and, asc, eq, ilike, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/streak";
import { sendPushToUser } from "@/lib/push";
import { put } from "@vercel/blob";
import { createNotification } from "@/lib/notifications";

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB per file (modern phone photos run ~3–6 MB)
const MAX_FILES_PER_POST = 10;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const ALLOWED_PDF_TYPES = new Set(["application/pdf"]);

export type Attachment = {
  type: "image" | "pdf" | "video" | "gif";
  url: string;
  filename: string;
  size: number;
};

/**
 * Upload one or more files to Vercel Blob and return the URL list.
 * Called from the client when a member attaches files to a new post.
 */
export async function uploadPostAttachments(formData: FormData): Promise<{
  ok: boolean;
  attachments?: Attachment[];
  error?: string;
}> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { ok: false, error: "not_authenticated" };

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { ok: false, error: "Blob storage not configured" };
  }

  const files = formData.getAll("files") as File[];
  if (!files.length) return { ok: false, error: "No files" };
  if (files.length > MAX_FILES_PER_POST) {
    return { ok: false, error: `Max ${MAX_FILES_PER_POST} files per post` };
  }

  const attachments: Attachment[] = [];
  for (const file of files) {
    if (!(file instanceof File) || file.size === 0) continue;
    if (file.size > MAX_FILE_BYTES) {
      return {
        ok: false,
        error: `"${file.name}" is too big (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_FILE_BYTES / 1024 / 1024} MB per file.`,
      };
    }

    const isImage = ALLOWED_IMAGE_TYPES.has(file.type);
    const isPdf = ALLOWED_PDF_TYPES.has(file.type);
    if (!isImage && !isPdf) {
      return {
        ok: false,
        error: `"${file.name}" is not a supported file type. Use JPG, PNG, WEBP, HEIC, or PDF.`,
      };
    }

    // Use a randomized path so two uploads of the same filename don't collide
    const ext = file.name.split(".").pop() || (isImage ? "jpg" : "pdf");
    const key = `community/${clerkId.slice(0, 12)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const blob = await put(key, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
    });

    attachments.push({
      type: isImage ? "image" : "pdf",
      url: blob.url,
      filename: file.name,
      size: file.size,
    });
  }

  return { ok: true, attachments };
}

export async function createPost(input: {
  body: string;
  category?: string;
  attachments?: Attachment[];
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("not authenticated");
  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) throw new Error("no user");

  const body = input.body.trim().slice(0, 4000);
  // Accept post if it has a body OR at least one attachment (photo-only posts allowed)
  if (!body && (!input.attachments || !input.attachments.length)) return;

  const [newPost] = await db
    .insert(posts)
    .values({
      userId: me.id,
      body,
      category: (input.category ?? "general") as
        | "general" | "wins" | "questions" | "recipes" | "transformation",
      attachments: input.attachments ?? [],
    })
    .returning();

  await logActivity({
    userId: me.id,
    type: "post_created",
    referenceId: newPost.id,
    timezone: me.timezone ?? undefined,
  });

  revalidatePath("/community");
  revalidatePath("/dashboard");
}

async function requireMember() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("not authenticated");
  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) throw new Error("no user");
  return me;
}

export async function togglePostLike(postId: string): Promise<{ liked: boolean; likeCount: number }> {
  const me = await requireMember();

  const [existing] = await db
    .select()
    .from(postLikes)
    .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, me.id)))
    .limit(1);

  if (existing) {
    await db
      .delete(postLikes)
      .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, me.id)));
    const [row] = await db
      .update(posts)
      .set({ likeCount: sql`GREATEST(${posts.likeCount} - 1, 0)` })
      .where(eq(posts.id, postId))
      .returning({ likeCount: posts.likeCount });
    revalidatePath("/community");
    return { liked: false, likeCount: row?.likeCount ?? 0 };
  }

  await db.insert(postLikes).values({ postId, userId: me.id });
  const [row] = await db
    .update(posts)
    .set({ likeCount: sql`${posts.likeCount} + 1` })
    .where(eq(posts.id, postId))
    .returning({ likeCount: posts.likeCount });

  // Notify post author (in-app only — no push for likes to avoid spam)
  const [likedPost] = await db
    .select({ userId: posts.userId })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  if (likedPost && likedPost.userId !== me.id) {
    const likerName =
      `${me.firstName ?? "Someone"} ${(me.lastName ?? "").slice(0, 1)}${me.lastName ? "." : ""}`.trim();
    createNotification(likedPost.userId, {
      type: "post_reply",
      title: `${likerName} liked your post`,
      actionUrl: `/community/posts/${postId}`,
    });
  }

  revalidatePath("/community");
  return { liked: true, likeCount: row?.likeCount ?? 0 };
}

export type CommentAttachment = {
  type: "image" | "video" | "gif";
  url: string;
  filename: string;
  size: number;
};

export type CommentRow = {
  id: string;
  body: string;
  createdAt: Date;
  authorId: string | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorAvatarUrl: string | null;
  parentId: string | null;
  attachments: CommentAttachment[];
};

export type MemberSearchResult = {
  id: string;
  firstName: string | null;
  lastName: string | null;
};

export async function loadComments(postId: string): Promise<CommentRow[]> {
  await requireMember();
  const rows = await db
    .select({
      id: postComments.id,
      body: postComments.body,
      createdAt: postComments.createdAt,
      authorId: users.id,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      authorAvatarUrl: users.avatarUrl,
      parentId: postComments.parentId,
      attachments: postComments.attachments,
    })
    .from(postComments)
    .leftJoin(users, eq(users.id, postComments.userId))
    .where(eq(postComments.postId, postId))
    .orderBy(asc(postComments.createdAt));
  return rows;
}

export async function searchMembers(query: string): Promise<MemberSearchResult[]> {
  await requireMember();
  if (!query || query.length < 1) return [];
  return db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(ilike(users.firstName, `${query}%`))
    .limit(6);
}

export async function editPost(
  postId: string,
  rawBody: string
): Promise<{ ok: boolean; error?: string }> {
  const me = await requireMember();
  const body = rawBody.trim().slice(0, 4000);
  if (!body) return { ok: false, error: "Post can't be empty." };

  const [post] = await db.select({ userId: posts.userId }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) return { ok: false, error: "Post not found." };
  if (post.userId !== me.id) return { ok: false, error: "Not your post." };

  await db.update(posts).set({ body, updatedAt: new Date() }).where(eq(posts.id, postId));
  revalidatePath("/community");
  return { ok: true };
}

export async function deletePost(postId: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireMember();

  const [post] = await db.select({ userId: posts.userId }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) return { ok: false, error: "Post not found." };
  if (post.userId !== me.id) return { ok: false, error: "Not your post." };

  await db.delete(posts).where(eq(posts.id, postId));
  revalidatePath("/community");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addComment(
  postId: string,
  rawBody: string,
  parentId?: string | null,
  attachments?: CommentAttachment[],
): Promise<{ ok: true; comment: CommentRow; commentCount: number } | { ok: false; error: string }> {
  const me = await requireMember();
  const body = rawBody.trim().slice(0, 2000);
  if (!body && (!attachments || attachments.length === 0)) {
    return { ok: false, error: "Comment can't be empty." };
  }

  const [created] = await db
    .insert(postComments)
    .values({ postId, userId: me.id, body, parentId: parentId ?? null, attachments: attachments ?? [] })
    .returning();

  // Notify the post's author (unless it's their own comment). Fire-and-forget;
  // a failed push must not block the comment from saving.
  const [postRow] = await db
    .select({ userId: posts.userId })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  const actorName =
    `${me.firstName ?? "Someone"} ${(me.lastName ?? "").slice(0, 1)}${me.lastName ? "." : ""}`.trim();

  if (postRow && postRow.userId !== me.id) {
    sendPushToUser(postRow.userId, {
      title: `${actorName} commented on your post`,
      body: body.slice(0, 140),
      url: `/community/posts/${postId}`,
      tag: `post-${postId}`,
    }).catch((err) => console.warn("comment push failed", err));
    createNotification(postRow.userId, {
      type: "post_reply",
      title: `${actorName} commented on your post`,
      body: body.slice(0, 200),
      actionUrl: `/community/posts/${postId}`,
    });
  }

  // If this is a reply, also notify the parent comment's author (unless they're the post author,
  // who already got notified above, or the commenter themselves).
  if (parentId) {
    const [parentComment] = await db
      .select({ userId: postComments.userId })
      .from(postComments)
      .where(eq(postComments.id, parentId))
      .limit(1);
    const parentAuthorId = parentComment?.userId;
    if (parentAuthorId && parentAuthorId !== me.id && parentAuthorId !== postRow?.userId) {
      sendPushToUser(parentAuthorId, {
        title: `${actorName} replied to your comment`,
        body: body.slice(0, 140),
        url: `/community/posts/${postId}`,
        tag: `reply-${parentId}`,
      }).catch(() => {});
      createNotification(parentAuthorId, {
        type: "post_reply",
        title: `${actorName} replied to your comment`,
        body: body.slice(0, 200),
        actionUrl: `/community/posts/${postId}`,
      });
    }
  }

  // @mention detection — fire-and-forget
  const mentionedNames = [...body.matchAll(/@(\w+)/g)].map((m) => m[1].toLowerCase());
  if (mentionedNames.length > 0) {
    db.select({ id: users.id, firstName: users.firstName })
      .from(users)
      .then((allUsers) => {
        const commenterName = `${me.firstName ?? "Someone"}`.trim();
        for (const u of allUsers) {
          if (
            u.id !== me.id &&
            u.firstName &&
            mentionedNames.includes(u.firstName.toLowerCase())
          ) {
            createNotification(u.id, {
              type: "mention",
              title: `${commenterName} mentioned you`,
              body: body.slice(0, 200),
              actionUrl: `/community/posts/${postId}`,
            });
          }
        }
      })
      .catch(() => {});
  }

  const [row] = await db
    .update(posts)
    .set({ commentCount: sql`${posts.commentCount} + 1` })
    .where(eq(posts.id, postId))
    .returning({ commentCount: posts.commentCount });

  revalidatePath("/community");

  return {
    ok: true,
    comment: {
      id: created.id,
      body: created.body,
      createdAt: created.createdAt,
      authorId: me.id,
      authorFirstName: me.firstName,
      authorLastName: me.lastName,
      authorAvatarUrl: me.avatarUrl,
      parentId: created.parentId,
      attachments: (created.attachments ?? []) as CommentAttachment[],
    },
    commentCount: row?.commentCount ?? 0,
  };
}

async function requireAdmin() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;
  const [me] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return me?.role === "admin" ? me : null;
}

export async function pinPost(postId: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "unauthorized" };
  await db.update(posts).set({ pinnedBy: admin.id, pinnedAt: new Date() }).where(eq(posts.id, postId));
  revalidatePath("/community");
  return { ok: true };
}

export async function unpinPost(postId: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "unauthorized" };
  await db.update(posts).set({ pinnedBy: null, pinnedAt: null }).where(eq(posts.id, postId));
  revalidatePath("/community");
  return { ok: true };
}

export async function editComment(
  commentId: string,
  rawBody: string,
): Promise<{ ok: boolean; error?: string }> {
  const me = await requireMember();
  const body = rawBody.trim().slice(0, 2000);
  if (!body) return { ok: false, error: "Comment can't be empty." };

  const [comment] = await db
    .select({ userId: postComments.userId })
    .from(postComments)
    .where(eq(postComments.id, commentId))
    .limit(1);
  if (!comment) return { ok: false, error: "Comment not found." };
  if (comment.userId !== me.id) return { ok: false, error: "Not your comment." };

  await db.update(postComments).set({ body }).where(eq(postComments.id, commentId));
  revalidatePath("/community");
  return { ok: true };
}

export async function deleteComment(
  commentId: string,
  postId: string,
): Promise<{ ok: boolean; commentCount?: number; error?: string }> {
  const me = await requireMember();

  const [comment] = await db
    .select({ userId: postComments.userId })
    .from(postComments)
    .where(eq(postComments.id, commentId))
    .limit(1);
  if (!comment) return { ok: false, error: "Comment not found." };
  if (comment.userId !== me.id) return { ok: false, error: "Not your comment." };

  await db.delete(postComments).where(eq(postComments.id, commentId));
  const [row] = await db
    .update(posts)
    .set({ commentCount: sql`GREATEST(${posts.commentCount} - 1, 0)` })
    .where(eq(posts.id, postId))
    .returning({ commentCount: posts.commentCount });

  revalidatePath("/community");
  return { ok: true, commentCount: row?.commentCount ?? 0 };
}

const ALLOWED_EMOJIS = new Set(["🔥", "💪", "❤️", "😂"]);

export async function toggleReaction(
  postId: string,
  emoji: string
): Promise<{ counts: Record<string, number>; myReactions: string[] }> {
  const me = await requireMember();
  if (!ALLOWED_EMOJIS.has(emoji)) throw new Error("Invalid emoji");

  const [existing] = await db
    .select({ id: postReactions.id })
    .from(postReactions)
    .where(
      and(
        eq(postReactions.postId, postId),
        eq(postReactions.userId, me.id),
        eq(postReactions.emoji, emoji)
      )
    )
    .limit(1);

  if (existing) {
    await db.delete(postReactions).where(eq(postReactions.id, existing.id));
  } else {
    await db.insert(postReactions).values({ postId, userId: me.id, emoji });
  }

  // Return fresh counts + my reactions for this post
  const allReactions = await db
    .select({ emoji: postReactions.emoji, userId: postReactions.userId })
    .from(postReactions)
    .where(eq(postReactions.postId, postId));

  const counts: Record<string, number> = {};
  const myReactions: string[] = [];
  for (const r of allReactions) {
    counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
    if (r.userId === me.id) myReactions.push(r.emoji);
  }

  return { counts, myReactions };
}
