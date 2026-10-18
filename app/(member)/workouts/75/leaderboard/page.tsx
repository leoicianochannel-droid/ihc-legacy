import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Flame, Trophy, Medal, Award } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function initials(first?: string | null, last?: string | null) {
  return `${(first?.[0] ?? "").toUpperCase()}${(last?.[0] ?? "").toUpperCase()}` || "?";
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="size-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="size-5 text-slate-400" />;
  if (rank === 3) return <Award className="size-5 text-amber-600" />;
  return <span className="w-5 text-center text-sm font-bold text-muted-foreground">{rank}</span>;
}

export default async function IH75LeaderboardPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const [me] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) redirect("/onboarding");

  // Get all active enrollments with user info and their current day + completed days
  let leaderboard: Array<{
    userId: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    startedAt: string;
    currentDay: number;
    completedDays: number;
  }> = [];

  try {
    const rows = await db.execute(sql`
      SELECT
        u.id AS user_id,
        u.first_name,
        u.last_name,
        u.avatar_url,
        e.started_at::text,
        LEAST(
          FLOOR(EXTRACT(EPOCH FROM (NOW() - e.started_at::timestamptz)) / 86400)::int + 1,
          75
        ) AS current_day,
        COALESCE(c.completed_days, 0) AS completed_days
      FROM ih75_enrollments e
      JOIN users u ON u.id = e.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS completed_days
        FROM ih75_checkins
        WHERE all_done = TRUE
        GROUP BY user_id
      ) c ON c.user_id = e.user_id
      WHERE e.status = 'active'
      ORDER BY c.completed_days DESC NULLS LAST, e.started_at ASC
      LIMIT 100
    `);

    leaderboard = (rows as unknown as Array<{
      user_id: string;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
      started_at: string;
      current_day: number;
      completed_days: number;
    }>).map((r) => ({
      userId: r.user_id,
      firstName: r.first_name,
      lastName: r.last_name,
      avatarUrl: r.avatar_url,
      startedAt: r.started_at,
      currentDay: Number(r.current_day),
      completedDays: Number(r.completed_days),
    }));
  } catch {
    // table doesn't exist yet — empty board
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-2 md:px-10">
      <div className="mb-2 flex items-center gap-2">
        <Link href="/workouts/75" className="text-sm text-muted-foreground hover:text-foreground">
          ← IH 75
        </Link>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <Flame className="size-7 text-primary" />
        <div>
          <h1 className="font-display text-3xl font-bold">IH 75 Leaderboard</h1>
          <p className="text-sm text-muted-foreground">
            {leaderboard.length} member{leaderboard.length === 1 ? "" : "s"} currently enrolled
          </p>
        </div>
      </div>

      {leaderboard.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Flame className="mx-auto size-12 text-muted-foreground" />
            <p className="mt-4 font-display text-xl font-bold">No one enrolled yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Be the first to start IH 75!</p>
            <Link href="/workouts/75" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
              Start the challenge →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {leaderboard.map((member, idx) => {
              const rank = idx + 1;
              const isMe = member.userId === me.id;
              return (
                <div
                  key={member.userId}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3",
                    isMe && "bg-primary/5"
                  )}
                >
                  <div className="flex w-6 shrink-0 items-center justify-center">
                    <RankIcon rank={rank} />
                  </div>

                  <Avatar className="size-9 shrink-0">
                    {member.avatarUrl && <AvatarImage src={member.avatarUrl} />}
                    <AvatarFallback className="text-xs">
                      {initials(member.firstName, member.lastName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {member.firstName ?? ""} {member.lastName ?? ""}
                      {isMe && <span className="ml-2 text-xs font-normal text-primary">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">Day {member.currentDay} of 75</p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-primary">{member.completedDays}</p>
                    <p className="text-xs text-muted-foreground">days done</p>
                  </div>

                  {/* Progress mini-bar */}
                  <div className="hidden w-20 sm:block">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.round((member.completedDays / 75) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-right text-[10px] text-muted-foreground">
                      {Math.round((member.completedDays / 75) * 100)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
