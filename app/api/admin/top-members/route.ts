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
      u.id,
      u.first_name,
      u.last_name,
      u.email,
      u.onboarded_at,
      u.tier,
      COALESCE(al.workout_count, 0)   AS workout_count,
      COALESCE(p.post_count, 0)       AS post_count,
      COALESCE(pc.comment_count, 0)   AS comment_count,
      COALESCE(cc.checkin_count, 0)   AS checkin_count,
      COALESCE(s.current_streak, 0)   AS current_streak,
      -- weighted score
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
      WHERE type = 'workout_complete'
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
      SELECT user_id, count(*) AS checkin_count
      FROM challenge_checkins
      GROUP BY user_id
    ) cc ON cc.user_id = u.id
    LEFT JOIN (
      SELECT user_id, current_streak
      FROM streaks
    ) s ON s.user_id = u.id
    WHERE u.role = 'member'
    ORDER BY score DESC
    LIMIT 50
  `);

  return NextResponse.json({ members: rows });
}
