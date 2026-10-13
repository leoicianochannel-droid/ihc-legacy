import { db, users, migrationRecords } from "@/lib/db";
import { eq, isNull, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function MigrationLagPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (me?.role !== "admin") redirect("/dashboard");

  // Use skool_joined_at from the linked users row — that's the actual Skool
  // membership date (when they started paying), not the import date.
  // Deduplicate by source_email and exclude anyone who has activated.
  const rows = await db.execute(sql`
    WITH deduped AS (
      SELECT DISTINCT ON (mr.source_email)
        COALESCE(u.skool_joined_at, mr.invited_at, mr.created_at) AS ref_date
      FROM migration_records mr
      LEFT JOIN users u ON u.id = mr.user_id
      WHERE mr.source_email NOT IN (
        SELECT source_email FROM migration_records WHERE activated_at IS NOT NULL
      )
      AND mr.activated_at IS NULL
      ORDER BY mr.source_email, mr.id ASC
    )
    SELECT
      COUNT(*)                                                             AS total,
      COUNT(*) FILTER (WHERE ref_date > NOW() - INTERVAL '30 days')       AS bucket_0_30,
      COUNT(*) FILTER (
        WHERE ref_date <= NOW() - INTERVAL '30 days'
          AND ref_date >  NOW() - INTERVAL '60 days'
      )                                                                    AS bucket_31_60,
      COUNT(*) FILTER (
        WHERE ref_date <= NOW() - INTERVAL '60 days'
          AND ref_date >  NOW() - INTERVAL '90 days'
      )                                                                    AS bucket_61_90,
      COUNT(*) FILTER (WHERE ref_date <= NOW() - INTERVAL '90 days')      AS bucket_90_plus
    FROM deduped
  `);

  const r = (rows as Record<string, unknown>[])[0];
  const total = Number(r.total);
  const b0   = Number(r.bucket_0_30);
  const b31  = Number(r.bucket_31_60);
  const b61  = Number(r.bucket_61_90);
  const b90  = Number(r.bucket_90_plus);

  function pct(n: number) {
    if (!total) return "0";
    return ((n / total) * 100).toFixed(1);
  }

  const buckets = [
    { label: "0–30 days",  count: b0,  pct: pct(b0),  color: "bg-green-500",  risk: "Recently invited" },
    { label: "31–60 days", count: b31, pct: pct(b31), color: "bg-yellow-400", risk: "Getting cold" },
    { label: "61–90 days", count: b61, pct: pct(b61), color: "bg-orange-500", risk: "High risk" },
    { label: "90+ days",   count: b90, pct: pct(b90), color: "bg-red-500",    risk: "Likely churned" },
  ];

  return (
    <div className="container space-y-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Migration Lag Report</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Paying subscribers who were migrated from Skool but have never activated on the new platform,
            segmented by how long they&apos;ve been waiting.
          </p>
        </div>
        <a
          href="/api/admin/export-migration-lag"
          className="shrink-0 inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
        >
          Download CSV
        </a>
      </div>

      {/* Summary stat */}
      <div className="rounded-2xl border bg-card px-6 py-5">
        <div className="text-4xl font-display font-bold">{total.toLocaleString()}</div>
        <div className="text-sm text-muted-foreground mt-0.5">total unmigrated paying subscribers</div>
      </div>

      {/* Cohort breakdown */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {buckets.map((b) => (
          <Card key={b.label}>
            <CardContent className="p-5">
              <div className="text-3xl font-display font-bold">{b.count.toLocaleString()}</div>
              <div className="text-xs font-semibold text-muted-foreground mt-0.5">{b.label}</div>
              <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${b.color}`}
                  style={{ width: `${b.pct}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>{b.pct}% of total</span>
                <span className="font-medium">{b.risk}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Visual bar */}
      <Card>
        <CardContent className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Distribution
          </p>
          <div className="flex h-8 w-full overflow-hidden rounded-xl">
            {buckets.map((b) => (
              Number(b.pct) > 0 && (
                <div
                  key={b.label}
                  className={`${b.color} flex items-center justify-center text-[10px] font-bold text-white`}
                  style={{ width: `${b.pct}%` }}
                  title={`${b.label}: ${b.count} (${b.pct}%)`}
                >
                  {Number(b.pct) > 8 ? `${b.pct}%` : ""}
                </div>
              )
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {buckets.map((b) => (
              <div key={b.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className={`size-2.5 rounded-full ${b.color}`} />
                {b.label}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Duration measured from the date each member was invited to the platform (or when their record was
        created if no invite date is recorded). All members in this list have an active or past-due
        Skool/Shopify subscription.
      </p>
    </div>
  );
}
