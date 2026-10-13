import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const rows = await db.execute(sql`
    SELECT
      u.first_name,
      u.last_name,
      u.email,
      u.tier,
      u.onboarded_at,
      COALESCE(al.workout_count, 0)   AS workouts,
      COALESCE(p.post_count, 0)       AS posts,
      COALESCE(pc.comment_count, 0)   AS comments,
      COALESCE(cc.checkin_count, 0)   AS challenge_checkins,
      COALESCE(s.current_streak, 0)   AS current_streak,
      (
        COALESCE(al.workout_count, 0) * 3 +
        COALESCE(p.post_count, 0)     * 4 +
        COALESCE(pc.comment_count, 0) * 2 +
        COALESCE(cc.checkin_count, 0) * 2 +
        COALESCE(s.current_streak, 0) * 1
      ) AS score
    FROM users u
    LEFT JOIN (
      SELECT user_id, count(*) AS workout_count
      FROM activity_log
      WHERE type = 'workout_completed'
      GROUP BY user_id
    ) al ON al.user_id = u.id
    LEFT JOIN (
      SELECT user_id, count(*) AS post_count
      FROM posts
      GROUP BY user_id
    ) p ON p.user_id = u.id
    LEFT JOIN (
      SELECT user_id, count(*) AS comment_count
      FROM post_comments
      GROUP BY user_id
    ) pc ON pc.user_id = u.id
    LEFT JOIN (
      SELECT
        cm.user_id,
        count(*) AS checkin_count
      FROM challenge_checkins cci
      JOIN challenge_members cm ON cm.id = cci.challenge_member_id
      GROUP BY cm.user_id
    ) cc ON cc.user_id = u.id
    LEFT JOIN (
      SELECT user_id, current AS current_streak
      FROM streaks
    ) s ON s.user_id = u.id
    WHERE u.role = 'member'
    ORDER BY score DESC
    LIMIT 100
  `);

  function esc(v: unknown) {
    return `"${String(v ?? "").replace(/"/g, '""')}"`;
  }

  const header = "rank,first_name,last_name,email,tier,member_since,workouts,posts,comments,challenge_checkins,current_streak,score";
  const lines = (rows as Record<string, unknown>[]).map((r, i) => [
    i + 1,
    esc(r.first_name),
    esc(r.last_name),
    esc(r.email),
    esc(r.tier),
    esc(r.onboarded_at ? new Date(r.onboarded_at as string).toISOString().slice(0, 10) : ""),
    r.workouts,
    r.posts,
    r.comments,
    r.challenge_checkins,
    r.current_streak,
    r.score,
  ].join(","));

  return new NextResponse([header, ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="top-100-members-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
