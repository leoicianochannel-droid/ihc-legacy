import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db, users, streaks, posts, activityLog } from "@/lib/db";
import { eq, desc, and, count, sql } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, Trophy, Dumbbell, MessageCircle, CalendarDays, CheckCircle2 } from "lucide-react";
import { formatDate, relativeTime } from "@/lib/utils";

const TIER_LABELS: Record<string, string> = {
  starter: "Starter",
  mover: "💫 Mover",
  champion: "🔥 Champion",
  legend: "👑 Legend",
};

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  // Load the viewed member
  const [member] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!member) notFound();

  // Who's logged in?
  const [me] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  const isOwnProfile = me?.id === member.id;

  // Streak
  const [streak] = await db
    .select()
    .from(streaks)
    .where(eq(streaks.userId, member.id))
    .limit(1);

  // Total workouts completed (all time)
  const [{ workoutCount }] = await db
    .select({ workoutCount: count() })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.userId, member.id),
        eq(activityLog.type, "workout_completed")
      )
    );

  // Check-ins this month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [{ checkinCount }] = await db
    .select({ checkinCount: count() })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.userId, member.id),
        eq(activityLog.type, "daily_checkin"),
        sql`${activityLog.createdAt} >= ${monthStart.toISOString()}`
      )
    );

  // Recent posts
  const recentPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.userId, member.id))
    .orderBy(desc(posts.createdAt))
    .limit(5);

  const displayName = [member.firstName, member.lastName].filter(Boolean).join(" ") || "Member";
  const initials = (member.firstName ?? "M").slice(0, 1).toUpperCase();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-10 md:py-10">
      {/* Profile header */}
      <Card className="overflow-hidden">
        {/* Hero gradient bar */}
        <div className="h-24 bg-primary/20" />

        <CardContent className="px-6 pb-6">
          {/* Avatar — overlaps the gradient */}
          <div className="-mt-12 mb-4 flex items-end justify-between">
            <Avatar className="size-20 ring-4 ring-background">
              <AvatarImage src={member.avatarUrl ?? undefined} />
              <AvatarFallback className="text-2xl font-bold">{initials}</AvatarFallback>
            </Avatar>

            {!isOwnProfile && me && (
              <Button asChild size="sm" variant="outline">
                <a href={`/messages/start?userId=${member.id}`}>
                  <MessageCircle className="size-4" /> Message
                </a>
              </Button>
            )}
            {isOwnProfile && (
              <Button asChild size="sm" variant="outline">
                <Link href="/settings">Edit profile</Link>
              </Button>
            )}
          </div>

          <h1 className="font-display text-2xl font-bold">{displayName}</h1>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            {member.tier && member.tier !== "starter" ? (
              <Badge variant="secondary" className="text-xs font-bold">
                {TIER_LABELS[member.tier] ?? member.tier}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                {TIER_LABELS["starter"]}
              </Badge>
            )}
            {member.migratedFromSkool && (
              <Badge className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700">
                ⭐ Founding Member
              </Badge>
            )}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="size-3" />
              Member since {formatDate(member.createdAt, { month: "long", year: "numeric", day: undefined })}
            </span>
          </div>

          {member.goal && (
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Goal:</span> {member.goal}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <Flame className="mx-auto size-5 text-orange-500" />
          <div className="mt-1 font-display text-2xl font-bold">{streak?.current ?? 0}</div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">day streak</div>
        </Card>
        <Card className="p-4 text-center">
          <Dumbbell className="mx-auto size-5 text-primary" />
          <div className="mt-1 font-display text-2xl font-bold">{Number(workoutCount)}</div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">workouts</div>
        </Card>
        <Card className="p-4 text-center">
          <CheckCircle2 className="mx-auto size-5 text-emerald-500" />
          <div className="mt-1 font-display text-2xl font-bold">{Number(checkinCount)}</div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">check-ins this month</div>
        </Card>
      </div>

      {/* Longest streak badge */}
      {(streak?.longest ?? 0) > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm">
          <Trophy className="size-4 text-primary" />
          <span>
            Personal best streak:{" "}
            <strong>{streak!.longest} days</strong>
          </span>
        </div>
      )}

      {/* Recent posts */}
      <div className="mt-8">
        <h2 className="mb-3 font-display text-xl font-bold">Recent posts</h2>
        {recentPosts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {isOwnProfile ? "You haven't posted yet — share something with the community!" : "No posts yet."}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {recentPosts.map((post) => (
              <Card key={post.id} className="transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary capitalize">
                      {post.category}
                    </span>
                    <span className="text-xs text-muted-foreground">{relativeTime(post.createdAt)}</span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-foreground/90">
                    {post.body}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>❤️ {post.likeCount}</span>
                    <span>💬 {post.commentCount}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {isOwnProfile && (
        <div className="mt-4">
          <Button asChild variant="outline" className="w-full">
            <Link href="/community">Post in community →</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
