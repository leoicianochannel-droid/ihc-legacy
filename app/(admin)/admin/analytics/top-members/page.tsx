import { db, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TopMembersPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (me?.role !== "admin") redirect("/dashboard");

  const rows = await db.execute(sql`
    SELECT
      u.first_name,
      u.last_name,
      u.email,
      u.onboarded_at,
      u.tier,
      COALESCE(al.workout_count, 0)   AS workout_count,
      COALESCE(p.post_count, 0)       AS post_count,
      COALESCE(pc.comment_count, 0)   AS comment_count,
      COALESCE(cc.checkin_count, 0)   AS checkin_count,
      COALESCE(s.current, 0)          AS current_streak,
      (
        COALESCE(al.workout_count, 0) * 3 +
        COALESCE(p.post_count, 0)     * 4 +
        COALESCE(pc.comment_count, 0) * 2 +
        COALESCE(cc.checkin_count, 0) * 2 +
        COALESCE(s.current, 0)        * 1
      ) AS score
    FROM users u
    LEFT JOIN (
      SELECT user_id, count(*) AS workout_count
      FROM activity_log WHERE type = 'workout_completed'
      GROUP BY user_id
    ) al ON al.user_id = u.id
    LEFT JOIN (
      SELECT user_id, count(*) AS post_count FROM posts GROUP BY user_id
    ) p ON p.user_id = u.id
    LEFT JOIN (
      SELECT user_id, count(*) AS comment_count FROM post_comments GROUP BY user_id
    ) pc ON pc.user_id = u.id
    LEFT JOIN (
      SELECT cm.user_id, count(*) AS checkin_count
      FROM challenge_checkins cc2
      JOIN challenge_members cm ON cm.id = cc2.challenge_member_id
      GROUP BY cm.user_id
    ) cc ON cc.user_id = u.id
    LEFT JOIN (
      SELECT user_id, current FROM streaks
    ) s ON s.user_id = u.id
    WHERE u.role = 'member'
    ORDER BY score DESC
    LIMIT 50
  `);

  const members = (rows as unknown) as {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    onboarded_at: Date | null;
    tier: string | null;
    workout_count: number;
    post_count: number;
    comment_count: number;
    checkin_count: number;
    current_streak: number;
    score: number;
  }[];

  return (
    <div className="container space-y-6 py-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Top 50 Most Active Members</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Scored by: workouts ×3 · posts ×4 · comments ×2 · challenge check-ins ×2 · streak ×1
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left w-8">#</th>
                  <th className="px-3 py-2 text-left">Member</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-center">Tier</th>
                  <th className="px-3 py-2 text-center">Workouts</th>
                  <th className="px-3 py-2 text-center">Posts</th>
                  <th className="px-3 py-2 text-center">Comments</th>
                  <th className="px-3 py-2 text-center">Check-ins</th>
                  <th className="px-3 py-2 text-center">Streak</th>
                  <th className="px-3 py-2 text-center font-semibold">Score</th>
                  <th className="px-3 py-2 text-left">Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{i + 1}</td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      {m.first_name ?? ""} {m.last_name ?? ""}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{m.email}</td>
                    <td className="px-3 py-2 text-center">
                      {m.tier && m.tier !== "starter" ? (
                        <span className="capitalize rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          {m.tier}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">{m.workout_count}</td>
                    <td className="px-3 py-2 text-center">{m.post_count}</td>
                    <td className="px-3 py-2 text-center">{m.comment_count}</td>
                    <td className="px-3 py-2 text-center">{m.checkin_count}</td>
                    <td className="px-3 py-2 text-center">{m.current_streak}d</td>
                    <td className="px-3 py-2 text-center font-bold">{Number(m.score).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {m.onboarded_at ? formatDate(m.onboarded_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
