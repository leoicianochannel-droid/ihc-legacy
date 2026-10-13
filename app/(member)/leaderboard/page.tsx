import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Flame, Trophy, Heart, Star } from "lucide-react";
import {
  topByWorkouts,
  topByStreak,
  topByEncouragement,
  topByChallengeCheckins,
  type LeaderRow,
} from "@/lib/leaderboard";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [workouts, streaks, encouragement, challengeCheckins] = await Promise.all([
    topByWorkouts(),
    topByStreak(),
    topByEncouragement(),
    topByChallengeCheckins(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-10 md:py-8">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
        🏆 This week
      </div>
      <h1 className="font-display text-3xl font-bold md:text-4xl">Leaderboards</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Effort-only rankings — celebrating the women who showed up. Refreshes every visit.
      </p>

      <div className="mt-6 space-y-4">
        <Board
          icon={<Star className="size-4" />}
          title="30-Day Challenge"
          subtitle="Most days completed this run — July 2026"
          rows={challengeCheckins}
          unitSingular="day"
          unitPlural="days completed"
          empty="No check-ins yet — join the challenge and be first on the board."
          highlight
        />

        <Board
          icon={<Trophy className="size-4" />}
          title="Most Workouts"
          subtitle="Top hoopers by sessions completed this week"
          rows={workouts}
          unitSingular="workout"
          unitPlural="workouts"
          empty="No workouts logged yet this week — be the first."
        />

        <Board
          icon={<Flame className="size-4" />}
          title="Longest Active Streaks"
          subtitle="Showing up day after day"
          rows={streaks}
          unitSingular="day"
          unitPlural="days"
          empty="No active streaks yet — start one today."
        />

        <Board
          icon={<Heart className="size-4" />}
          title="Most Encouraging"
          subtitle="The women lifting everyone up — comments left this week"
          rows={encouragement}
          unitSingular="comment"
          unitPlural="comments"
          empty="No comments yet this week — leave one to encourage someone."
        />
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        We don't rank weight or inches — that's private. We rank effort, because effort is the part you control.
      </p>
    </div>
  );
}

// ─── Board component ────────────────────────────────────────────────
function Board({
  icon,
  title,
  subtitle,
  rows,
  unitSingular,
  unitPlural,
  empty,
  highlight,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  rows: LeaderRow[];
  unitSingular: string;
  unitPlural: string;
  empty: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary/40 ring-2 ring-primary/15" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="text-primary">{icon}</span>
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed py-6 text-center text-sm text-muted-foreground">
            {empty}
          </p>
        ) : (
          <ol className="space-y-2">
            {rows.map((row, i) => {
              const rank = i + 1;
              const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
              return (
                <li
                  key={row.userId}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-3 transition-colors",
                    rank <= 3 && "border-primary/30 bg-primary/5"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold",
                      rank <= 3
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground/70"
                    )}
                  >
                    {medal ?? rank}
                  </span>
                  <Avatar className="size-9 shrink-0">
                    <AvatarImage src={row.avatarUrl ?? undefined} />
                    <AvatarFallback>
                      {(row.firstName ?? "U").slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/profile/${row.userId}`}
                        className="truncate font-semibold hover:underline"
                      >
                        {row.firstName ?? "Member"}{" "}
                        {(row.lastName ?? "").slice(0, 1)}
                        {row.lastName ? "." : ""}
                      </Link>
                      {row.tier && row.tier !== "starter" && (
                        <span className="hidden rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary sm:inline">
                          {row.tier}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-display text-xl font-bold">
                      {row.count}
                    </span>{" "}
                    <span className="text-xs text-muted-foreground">
                      {row.count === 1 ? unitSingular : unitPlural}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
