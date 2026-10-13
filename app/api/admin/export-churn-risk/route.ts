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
      sub.status                                                    AS sub_status,
      latest.last_active_at,
      CASE
        WHEN latest.last_active_at IS NULL THEN NULL
        ELSE EXTRACT(DAY FROM NOW() - latest.last_active_at)::int
      END                                                           AS days_inactive
    FROM users u
    LEFT JOIN LATERAL (
      SELECT MAX(created_at) AS last_active_at
      FROM activity_log
      WHERE user_id = u.id
    ) latest ON true
    LEFT JOIN LATERAL (
      SELECT status FROM subscriptions
      WHERE user_id = u.id
      ORDER BY updated_at DESC
      LIMIT 1
    ) sub ON true
    WHERE u.role = 'member'
      AND (
        latest.last_active_at IS NULL
        OR latest.last_active_at < NOW() - INTERVAL '14 days'
      )
      AND NOT EXISTS (
        SELECT 1 FROM challenge_members cm
        JOIN challenges c ON c.id = cm.challenge_id
        WHERE cm.user_id = u.id
          AND cm.completed_at IS NULL
          AND c.is_active = true
      )
    ORDER BY latest.last_active_at ASC NULLS FIRST
    LIMIT 500
  `);

  function esc(v: unknown) {
    return `"${String(v ?? "").replace(/"/g, '""')}"`;
  }

  const header = "first_name,last_name,email,tier,sub_status,member_since,last_active,days_inactive";
  const lines = (rows as Record<string, unknown>[]).map((r) => [
    esc(r.first_name),
    esc(r.last_name),
    esc(r.email),
    esc(r.tier),
    esc(r.sub_status ?? "none"),
    esc(r.onboarded_at ? new Date(r.onboarded_at as string).toISOString().slice(0, 10) : ""),
    esc(r.last_active_at ? new Date(r.last_active_at as string).toISOString().slice(0, 10) : "never"),
    r.days_inactive ?? "never",
  ].join(","));

  return new NextResponse([header, ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="churn-risk-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
