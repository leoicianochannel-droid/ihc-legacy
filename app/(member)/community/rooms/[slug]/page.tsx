import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import {
  db, users, rooms, roomMembers, posts,
  postLikes, postComments, postReactions, pollOptions, pollVotes, postBookmarks,
} from "@/lib/db";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { PostCard } from "../../post-card";
import { NewPostForm } from "../../new-post-form";
import { ChevronLeft, Users } from "lucide-react";
import type { CommentRow } from "../../actions";
import { RoomJoinButton } from "./room-join-button";

export const dynamic = "force-dynamic";

export default async function RoomFeedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [room] = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.slug, slug), eq(rooms.isActive, true)))
    .limit(1);

  if (!room) notFound();

  const { userId: clerkId } = await auth();

  let meId: string | null = null;
  let meFirstName: string | null = null;
  let meAvatarUrl: string | null = null;
  let isAdmin = false;
  let isMember = false;

  if (clerkId) {
    const [me] = await db
      .select({ id: users.id, firstName: users.firstName, avatarUrl: users.avatarUrl, role: users.role })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);
    if (me) {
      meId = me.id;
      meFirstName = me.firstName;
      meAvatarUrl = me.avatarUrl;
      isAdmin = me.role === "admin";
    }
  }

  const [memberCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(roomMembers)
    .where(eq(roomMembers.roomId, room.id));

  if (meId) {
    const [membership] = await db
      .select({ id: roomMembers.id })
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.userId, meId)))
      .limit(1);
    isMember = !!membership;
  }

  const rows = await db
    .select({ post: posts, author: users })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.userId))
    .where(eq(posts.roomId, room.id))
    .orderBy(desc(posts.createdAt))
    .limit(30)
    .catch(() => []);

  // Per-post data
  const likedPostIds = new Set<string>();
  const bookmarkedPostIds = new Set<string>();
  const reactionCountsByPost = new Map<string, Record<string, number>>();
  const myReactionsByPost = new Map<string, string[]>();
  const previewByPost = new Map<string, CommentRow[]>();
  const pollOptionsByPost = new Map<string, { id: string; text: string; position: number; voteCount: number }[]>();
  const myVoteByPost = new Map<string, string>();

  if (rows.length > 0) {
    const ids = rows.map((r) => r.post.id);

    const [likesResult, allReactions, commentRows, allPollOptions, allPollVotes, myBookmarks] = await Promise.all([
      meId
        ? db.select({ postId: postLikes.postId }).from(postLikes)
            .where(and(eq(postLikes.userId, meId), inArray(postLikes.postId, ids)))
            .catch(() => [] as { postId: string }[])
        : Promise.resolve([] as { postId: string }[]),
      db.select({ postId: postReactions.postId, emoji: postReactions.emoji, userId: postReactions.userId })
        .from(postReactions).where(inArray(postReactions.postId, ids)).catch(() => []),
      db.select({
          id: postComments.id, body: postComments.body, createdAt: postComments.createdAt,
          postId: postComments.postId, parentId: postComments.parentId, attachments: postComments.attachments,
          authorId: users.id, authorFirstName: users.firstName, authorLastName: users.lastName, authorAvatarUrl: users.avatarUrl,
        })
        .from(postComments)
        .leftJoin(users, eq(users.id, postComments.userId))
        .where(inArray(postComments.postId, ids))
        .orderBy(desc(postComments.createdAt))
        .catch(() => []),
      db.select({ id: pollOptions.id, postId: pollOptions.postId, text: pollOptions.text, position: pollOptions.position })
        .from(pollOptions).where(inArray(pollOptions.postId, ids)).catch(() => []),
      db.select({ postId: pollVotes.postId, optionId: pollVotes.optionId, userId: pollVotes.userId })
        .from(pollVotes).where(inArray(pollVotes.postId, ids)).catch(() => []),
      meId
        ? db.select({ postId: postBookmarks.postId }).from(postBookmarks)
            .where(and(eq(postBookmarks.userId, meId), inArray(postBookmarks.postId, ids)))
            .catch(() => [] as { postId: string }[])
        : Promise.resolve([] as { postId: string }[]),
    ]);

    likesResult.forEach((l) => likedPostIds.add(l.postId));
    myBookmarks.forEach((b) => bookmarkedPostIds.add(b.postId));

    for (const r of allReactions) {
      const counts = reactionCountsByPost.get(r.postId) ?? {};
      counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
      reactionCountsByPost.set(r.postId, counts);
      if (meId && r.userId === meId) {
        const mine = myReactionsByPost.get(r.postId) ?? [];
        mine.push(r.emoji);
        myReactionsByPost.set(r.postId, mine);
      }
    }

    const voteCountByOption = new Map<string, number>();
    for (const v of allPollVotes) {
      voteCountByOption.set(v.optionId, (voteCountByOption.get(v.optionId) ?? 0) + 1);
      if (meId && v.userId === meId) myVoteByPost.set(v.postId, v.optionId);
    }
    for (const opt of allPollOptions) {
      const list = pollOptionsByPost.get(opt.postId) ?? [];
      list.push({ ...opt, voteCount: voteCountByOption.get(opt.id) ?? 0 });
      pollOptionsByPost.set(opt.postId, list);
    }

    for (const c of commentRows) {
      const list = previewByPost.get(c.postId) ?? [];
      if (list.length < 2) {
        list.push({
          id: c.id, body: c.body, createdAt: c.createdAt, parentId: c.parentId,
          attachments: (c.attachments ?? []) as import("../../actions").CommentAttachment[],
          authorId: c.authorId, authorFirstName: c.authorFirstName,
          authorLastName: c.authorLastName, authorAvatarUrl: c.authorAvatarUrl,
        });
        previewByPost.set(c.postId, list);
      }
    }
  }

  return (
    <div className="mx-auto max-w-2xl bg-white pb-28 md:pb-10">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <Link href="/community/rooms" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ChevronLeft className="size-4" /> All rooms
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{room.emoji}</span>
            <div>
              <h1 className="text-[1.8rem] font-display font-extrabold tracking-tight text-gray-900 leading-none">
                {room.name}
              </h1>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                <Users className="size-3" />
                <span>{(memberCount?.count ?? 0).toLocaleString()} member{(memberCount?.count ?? 0) !== 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>
          {meId && (
            <RoomJoinButton roomId={room.id} initialJoined={isMember} />
          )}
        </div>
        {room.description && (
          <p className="mt-2 text-sm text-muted-foreground">{room.description}</p>
        )}
      </div>

      {/* New post form */}
      <div className="border-b border-gray-100 px-5 pb-5">
        <NewPostForm roomId={room.id} />
      </div>

      {/* Posts */}
      <div className="divide-y divide-gray-100">
        {rows.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-lg font-bold text-gray-900">No posts yet</p>
            <p className="mt-1 text-sm text-gray-400">Be the first to post in {room.name}.</p>
          </div>
        ) : (
          rows.map(({ post, author }) => (
            <div key={post.id} className="px-5">
              <PostCard
                post={post}
                author={author ? { id: author.id, firstName: author.firstName, lastName: author.lastName, avatarUrl: author.avatarUrl, tier: author.tier } : null}
                meId={meId}
                meFirstName={meFirstName}
                meAvatarUrl={meAvatarUrl}
                isAdmin={isAdmin}
                initialLiked={likedPostIds.has(post.id)}
                previewComments={previewByPost.get(post.id) ?? []}
                initialReactionCounts={reactionCountsByPost.get(post.id) ?? {}}
                initialMyReactions={myReactionsByPost.get(post.id) ?? []}
                pollOptions={pollOptionsByPost.get(post.id)}
                myVoteOptionId={myVoteByPost.get(post.id) ?? null}
                initialBookmarked={bookmarkedPostIds.has(post.id)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
