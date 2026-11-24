import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

const DEC_START = "2026-11-28T00:00:00.000Z";
const DEC_END   = "2026-12-31T23:59:59.999Z";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    // Top 10 by daily check-ins in December 2026, with post like counts for the community post prize
    const rows = await db.execute(sql`
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.tier,

        -- Category 1: Most Completions (daily check-ins in December)
        COALESCE(ci.checkin_count, 0) AS december_checkins,

        -- Category 2: Best Community Post (highest liked post in December)
        COALESCE(bp.best_post_likes, 0)   AS best_post_likes,
        bp.best_post_id,
        LEFT(bp.best_post_body, 120)       AS best_post_preview

      FROM users u

      LEFT JOIN (
        SELECT user_id, COUNT(*) AS checkin_count
        FROM activity_log
        WHERE type = 'daily_checkin'
          AND created_at >= ${DEC_START}
          AND created_at <= ${DEC_END}
        GROUP BY user_id
      ) ci ON ci.user_id = u.id

      LEFT JOIN (
        SELECT DISTINCT ON (user_id)
          user_id,
          id          AS best_post_id,
          like_count  AS best_post_likes,
          body        AS best_post_body
        FROM posts
        WHERE created_at >= ${DEC_START}
          AND created_at <= ${DEC_END}
          AND room_id IS NULL
        ORDER BY user_id, like_count DESC
      ) bp ON bp.user_id = u.id

      WHERE u.role != 'admin'
        AND (ci.checkin_count > 0 OR bp.best_post_likes > 0)

      ORDER BY ci.checkin_count DESC NULLS LAST, u.first_name
      LIMIT 25
    `);

    const data = Array.from(rows) as Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      tier: string | null;
      december_checkins: number;
      best_post_likes: number;
      best_post_id: string | null;
      best_post_preview: string | null;
    }>;

    const headers = [
      "checkin_rank",
      "first_name",
      "last_name",
      "email",
      "tier",
      "december_checkins",
      "best_post_likes",
      "best_post_id",
      "best_post_preview",
    ];

    const csv = [
      headers.join(","),
      ...data.map((r, i) =>
        [
          i + 1,
          r.first_name ?? "",
          r.last_name ?? "",
          r.email ?? "",
          r.tier ?? "",
          r.december_checkins,
          r.best_post_likes,
          r.best_post_id ?? "",
          `"${(r.best_post_preview ?? "").replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="december-challenge-results.csv"',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
