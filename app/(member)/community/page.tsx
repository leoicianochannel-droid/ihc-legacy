import Link from "next/link";
import { db, posts, users, postLikes, postComments, postReactions, challenges, pollOptions, pollVotes, postBookmarks } from "@/lib/db";
import { and, desc, eq, gte, ilike, inArray, isNull, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronRight, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { LivePill } from "@/components/live/live-pill";
import { NewPostForm } from "./new-post-form";
import { PostSearch } from "./post-search";
import { PostCard } from "./post-card";
import type { CommentRow } from "./actions";
import { topByStreak } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  { label: "Latest", value: null, href: "/community" },
  { label: "🔥 Hot", value: null, href: "/community?filter=hot" },
  { label: "Wins", value: "wins" as const, href: "/community?category=wins" },
  { label: "Questions", value: "questions" as const, href: "/community?category=questions" },
  { label: "Recipes", value: "recipes" as const, href: "/community?category=recipes" },
  { label: "Transformations", value: "transformation" as const, href: "/community?category=transformation" },
] as const;

type Category = "wins" | "questions" | "recipes" | "transformation" | "general";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; filter?: string; q?: string }>;
}) {
  const { category: rawCategory, filter: rawFilter, q: rawQ } = await searchParams;
  const validCategories = new Set<Category>([
    "wins",
    "questions",
    "recipes",
    "transformation",
    "general",
  ]);
  const activeCategory = validCategories.has(rawCategory as Category)
    ? (rawCategory as Category)
    : null;
  const myPostsActive = rawFilter === "mine";
  const hotActive = rawFilter === "hot";
  const savedActive = rawFilter === "saved";
  const searchQuery = rawQ?.trim().slice(0, 100) || null;

  // ── Phase 1: auth + sidebar data (all independent) ───────────────────────
  const [
    { userId: clerkId },
    memberCountResult,
    activeChallengeResult,
    streakLeadersRaw,
  ] = await Promise.all([
    auth(),
    db.select({ count: sql<number>`count(*)::int` })
      .from(users)
      .catch((err) => { console.error("[community] memberCount query failed:", err); return [{ count: 0 }]; }),
    db.select({ title: challenges.title, slug: challenges.slug, coverUrl: challenges.coverUrl })
      .from(challenges)
      .where(eq(challenges.isActive, true))
      .limit(1)
      .catch((err) => { console.error("[community] challenges query failed:", err); return [] as { title: string; slug: string; coverUrl: string | null }[]; }),
    topByStreak().catch((err) => { console.error("[community] streakLeaders failed:", err); return []; }),
  ]);

  const memberCount = memberCountResult[0]?.count ?? 0;
  const activeChallenge = activeChallengeResult[0];
  const streakLeaders = streakLeadersRaw.slice(0, 5);

  // ── Phase 2: resolve current member (needs clerkId) ───────────────────────
  const likedPostIds = new Set<string>();
  let meId: string | null = null;
  let meFirstName: string | null = null;
  let meAvatarUrl: string | null = null;
  let isAdmin = false;
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

  // ── Phase 3: posts + hasPosted (both depend on meId, run together) ────────
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const filters = [
    isNull(posts.roomId),  // main feed excludes room posts
    ...(activeCategory ? [eq(posts.category, activeCategory)] : []),
    ...(myPostsActive && meId ? [eq(posts.userId, meId)] : []),
    ...(hotActive ? [gte(posts.createdAt, fortyEightHoursAgo)] : []),
    ...(searchQuery ? [ilike(posts.body, `%${searchQuery}%`)] : []),
  ];

  const [rows, hasPostedResult] = await Promise.all([
    savedActive && meId
      ? db.select({ post: posts, author: users })
          .from(postBookmarks)
          .where(eq(postBookmarks.userId, meId))
          .innerJoin(posts, eq(posts.id, postBookmarks.postId))
          .leftJoin(users, eq(users.id, posts.userId))
          .orderBy(desc(postBookmarks.createdAt))
          .limit(30)
          .catch((err) => { console.error("[community] saved query failed:", err); return []; })
      : db.select({ post: posts, author: users })
          .from(posts)
          .leftJoin(users, eq(users.id, posts.userId))
          .where(filters.length > 0 ? and(...filters) : undefined)
          .orderBy(
            ...(hotActive
              ? [desc(sql`${posts.likeCount} + ${posts.commentCount}`)]
              : [
                  sql`${posts.pinnedAt} DESC NULLS LAST`,
                  desc(posts.createdAt),
                ])
          )
          .limit(30)
          .catch((err) => { console.error("[community] posts query failed:", err); return []; }),
    meId
      ? db.select({ count: sql<number>`count(*)::int` })
          .from(posts)
          .where(eq(posts.userId, meId))
          .limit(1)
          .catch(() => [{ count: 1 }])
      : Promise.resolve([{ count: 1 }]),
  ]);

  const hasPosted = (hasPostedResult[0]?.count ?? 0) > 0;

  // ── Phase 4: per-post data (all depend on post IDs, run together) ─────────
  const reactionCountsByPost = new Map<string, Record<string, number>>();
  const myReactionsByPost = new Map<string, string[]>();
  const previewByPost = new Map<string, CommentRow[]>();
  const pollOptionsByPost = new Map<string, { id: string; text: string; position: number; voteCount: number }[]>();
  const myVoteByPost = new Map<string, string>();
  const bookmarkedPostIds = new Set<string>();

  if (rows.length > 0) {
    const ids = rows.map((r) => r.post.id);

    const [likesResult, allReactions, commentRows, allPollOptions, allPollVotes, myBookmarks] = await Promise.all([
      meId
        ? db.select({ postId: postLikes.postId })
            .from(postLikes)
            .where(and(eq(postLikes.userId, meId), inArray(postLikes.postId, ids)))
            .catch((err) => { console.error("[community] likes query failed:", err); return [] as { postId: string }[]; })
        : Promise.resolve([] as { postId: string }[]),
      db.select({ postId: postReactions.postId, emoji: postReactions.emoji, userId: postReactions.userId })
        .from(postReactions)
        .where(inArray(postReactions.postId, ids))
        .catch(() => [] as { postId: string; emoji: string; userId: string }[]),
      db.select({
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
        .where(inArray(postComments.postId, ids))
        .orderBy(desc(postComments.createdAt))
        .catch((err) => { console.error("[community] comments query failed:", err); return []; }),
      db.select({ id: pollOptions.id, postId: pollOptions.postId, text: pollOptions.text, position: pollOptions.position })
        .from(pollOptions)
        .where(inArray(pollOptions.postId, ids))
        .catch(() => [] as { id: string; postId: string; text: string; position: number }[]),
      db.select({ postId: pollVotes.postId, optionId: pollVotes.optionId, userId: pollVotes.userId })
        .from(pollVotes)
        .where(inArray(pollVotes.postId, ids))
        .catch(() => [] as { postId: string; optionId: string; userId: string }[]),
      meId
        ? db.select({ postId: postBookmarks.postId })
            .from(postBookmarks)
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

    // Build vote count map per option
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

    // Cap at 2 preview comments per post in JS
    for (const c of commentRows) {
      const list = previewByPost.get(c.postId) ?? [];
      if (list.length < 2) {
        list.push({
          id: c.id,
          body: c.body,
          createdAt: c.createdAt,
          parentId: c.parentId,
          attachments: (c.attachments ?? []) as import("./actions").CommentAttachment[],
          authorId: c.authorId,
          authorFirstName: c.authorFirstName,
          authorLastName: c.authorLastName,
          authorAvatarUrl: c.authorAvatarUrl,
        });
        previewByPost.set(c.postId, list);
      }
    }
  }

  const CATEGORY_LABELS: Record<string, string> = {
    wins: "WINS",
    questions: "QUESTIONS",
    recipes: "RECIPES",
    transformation: "TRANSFORMATION",
    general: "GENERAL",
  };

  return (
    <div className="mx-auto max-w-2xl bg-white pb-28 md:pb-10">
      {/* Page header */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <h1 className="text-[2.2rem] font-display font-extrabold tracking-tight text-gray-900">Community</h1>
        <div className="flex items-center gap-3">
          <LivePill variant="compact" />
        </div>
      </div>

      {/* Search */}
      <div className="px-5 pb-4">
        <PostSearch defaultValue={searchQuery ?? undefined} />
      </div>

      {/* Category filter chips */}
      <div className="sticky top-0 z-10 bg-white/95 px-5 pb-3 pt-1 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => {
            const active =
              !myPostsActive &&
              (c.href === "/community?filter=hot"
                ? hotActive
                : c.value === activeCategory && !hotActive);
            return (
              <Link
                key={c.label}
                href={c.href}
                className={cn(
                  "shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors",
                  active
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {c.label}
              </Link>
            );
          })}
          <Link
            href="/community?filter=mine"
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors",
              myPostsActive
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            My Posts
          </Link>
          {meId && (
            <Link
              href="/community?filter=saved"
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors",
                savedActive
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              🔖 Saved
            </Link>
          )}
          <Link
            href="/community/rooms"
            className="shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            🏠 Rooms
          </Link>
        </div>
      </div>

      {/* New post section */}
      <div className="border-b border-gray-100 px-5 pb-5">
        <NewPostForm showIntroPrompt={!hasPosted} memberFirstName={meFirstName} />
      </div>

      {/* Streak leaderboard — inline, compact */}
      {streakLeaders.length > 0 && (
        <div className="border-b border-gray-100 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-1.5">
              <Flame className="size-4 text-orange-500" /> Top Streaks
            </h2>
            <Link href="/leaderboard" className="flex items-center gap-0.5 text-sm text-gray-400">
              See all <ChevronRight className="size-4" />
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-1">
            {streakLeaders.map((row, i) => (
              <Link key={row.userId} href={`/profile/${row.userId}`} className="flex shrink-0 flex-col items-center gap-1">
                <Avatar className="size-11 ring-2 ring-primary/20">
                  <AvatarImage src={row.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                    {(row.firstName ?? "U").slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[11px] font-semibold text-gray-700 truncate max-w-[52px] text-center">
                  {row.firstName ?? "Member"}
                </span>
                <span className="text-[11px] font-bold text-primary">🔥 {row.count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Section header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <h2 className="text-lg font-extrabold text-gray-900">
          {searchQuery ? `Results for "${searchQuery}"` : hotActive ? "🔥 Trending" : myPostsActive ? "My Posts" : savedActive ? "🔖 Saved Posts" : activeCategory ? CATEGORY_LABELS[activeCategory] ?? "Posts" : "Recent Posts"}
        </h2>
        <Link href="/community/members" className="flex items-center gap-0.5 text-sm text-gray-400">
          Members <ChevronRight className="size-4" />
        </Link>
      </div>

      {/* Post list — Sweat forum row style */}
      <div className="divide-y divide-gray-100">
        {rows.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-lg font-bold text-gray-900">
              {searchQuery ? `No posts matching "${searchQuery}"` : savedActive ? "No saved posts yet" : myPostsActive ? "You haven't posted yet" : activeCategory ? "Nothing in this category yet" : "Be the first to post"}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {searchQuery ? "Try different keywords." : savedActive ? "Tap the bookmark icon on any post to save it here." : myPostsActive ? "Share a win, ask a question, or drop a recipe." : "Tap the post box above to get started."}
            </p>
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
