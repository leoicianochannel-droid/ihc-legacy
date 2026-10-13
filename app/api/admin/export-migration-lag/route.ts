import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Use skool_joined_at as the true "paying since" date for each member.
  // Deduplicate by source_email, exclude anyone who has activated.
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (mr.source_email)
      COALESCE(mr.resolved_email, mr.source_email)                          AS email,
      mr.source_email,
      COALESCE(u.skool_joined_at, mr.invited_at, mr.created_at)             AS reference_date,
      EXTRACT(DAY FROM NOW() -
        COALESCE(u.skool_joined_at, mr.invited_at, mr.created_at))::int     AS days_without_activating,
      CASE
        WHEN COALESCE(u.skool_joined_at, mr.invited_at, mr.created_at) > NOW() - INTERVAL '30 days'
          THEN '0-30 days'
        WHEN COALESCE(u.skool_joined_at, mr.invited_at, mr.created_at) > NOW() - INTERVAL '60 days'
          THEN '31-60 days'
        WHEN COALESCE(u.skool_joined_at, mr.invited_at, mr.created_at) > NOW() - INTERVAL '90 days'
          THEN '61-90 days'
        ELSE '90+ days'
      END                                                                    AS cohort,
      mr.source
    FROM migration_records mr
    LEFT JOIN users u ON u.id = mr.user_id
    WHERE mr.source_email NOT IN (
      SELECT source_email FROM migration_records WHERE activated_at IS NOT NULL
    )
    AND mr.activated_at IS NULL
    ORDER BY mr.source_email, mr.id ASC
  `);

  function esc(v: unknown) {
    return `"${String(v ?? "").replace(/"/g, '""')}"`;
  }

  const header = "email,source_email,days_without_activating,cohort,invited_date,source";
  const lines = (rows as Record<string, unknown>[]).map((r) => [
    esc(r.email),
    esc(r.source_email),
    r.days_without_activating ?? 0,
    esc(r.cohort),
    esc(r.reference_date ? new Date(r.reference_date as string).toISOString().slice(0, 10) : ""),
    esc(r.source),
  ].join(","));

  return new NextResponse([header, ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="migration-lag-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
