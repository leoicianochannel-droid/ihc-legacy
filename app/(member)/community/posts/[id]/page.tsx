import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db, posts, users, postLikes, postComments, postReactions } from "@/lib/db";
import { and, asc, eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { PostCard } from "../../post-card";
import type { CommentRow } from "../../actions";

export const dynamic = "force-dynamic";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const [me] = await db
    .select({ id: users.id, firstName: users.firstName, avatarUrl: users.avatarUrl, role: users.role })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  const [row] = await db
    .select({ post: posts, author: users })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.userId))
    .where(eq(posts.id, id))
    .limit(1);

  if (!row) notFound();

  const meId = me?.id ?? null;

  const [likeRow] = meId
    ? await db
        .select({ postId: postLikes.postId })
        .from(postLikes)
        .where(and(eq(postLikes.userId, meId), eq(postLikes.postId, id)))
        .limit(1)
    : [null];

  const allReactions = await db
    .select({ emoji: postReactions.emoji, userId: postReactions.userId })
    .from(postReactions)
    .where(eq(postReactions.postId, id))
    .catch(() => [] as { emoji: string; userId: string }[]);

  const reactionCounts: Record<string, number> = {};
  const myReactions: string[] = [];
  for (const r of allReactions) {
    reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1;
    if (meId && r.userId === meId) myReactions.push(r.emoji);
  }

  // All comments for this post, oldest first
  const commentRows = await db
    .select({
      id: postComments.id,
      body: postComments.body,
      createdAt: postComments.createdAt,
      postId: postComments.postId,
      parentId: postComments.parentId,
      attachments: postComments.attachments,
      authorId: users.id,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(postComments)
    .leftJoin(users, eq(users.id, postComments.userId))
    .where(eq(postComments.postId, id))
    .orderBy(asc(postComments.createdAt));

  const comments: CommentRow[] = commentRows.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt,
    parentId: c.parentId,
    attachments: (c.attachments ?? []) as import("../../actions").CommentAttachment[],
    authorId: c.authorId,
    authorFirstName: c.authorFirstName,
    authorLastName: c.authorLastName,
    authorAvatarUrl: c.authorAvatarUrl,
  }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-10 md:py-8">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/community">
            <ChevronLeft className="size-4" /> Back to community
          </Link>
        </Button>
      </div>

      <PostCard
        post={row.post}
        author={row.author}
        meId={meId}
        meFirstName={me?.firstName ?? null}
        meAvatarUrl={me?.avatarUrl ?? null}
        isAdmin={me?.role === "admin"}
        initialLiked={!!likeRow}
        previewComments={comments}
        initialReactionCounts={reactionCounts}
        initialMyReactions={myReactions}
      />
    </div>
  );
}
