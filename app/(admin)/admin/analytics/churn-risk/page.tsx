import { db, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ChurnRiskPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (me?.role !== "admin") redirect("/dashboard");

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

  const members = (rows as unknown) as {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    tier: string | null;
    onboarded_at: Date | null;
    sub_status: string | null;
    last_active_at: Date | null;
    days_inactive: number | null;
  }[];

  function subBadgeClass(status: string | null) {
    if (status === "active") return "bg-green-500/10 text-green-600";
    if (status === "past_due" || status === "unpaid") return "bg-amber-500/10 text-amber-600";
    if (status === "canceled") return "bg-red-500/10 text-red-600";
    return "bg-muted text-muted-foreground";
  }

  return (
    <div className="container space-y-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Churn Risk Members</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Members with no activity in 14+ days who are not currently in an active challenge.
            Showing up to 500, sorted by least-recently-active first.
          </p>
        </div>
        <a
          href="/api/admin/export-churn-risk"
          className="shrink-0 inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
        >
          Download CSV
        </a>
      </div>

      <div className="flex gap-4 text-sm">
        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="text-2xl font-bold">{members.length}</div>
          <div className="text-xs text-muted-foreground">At-risk members</div>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="text-2xl font-bold">
            {members.filter((m) => m.sub_status === "active").length}
          </div>
          <div className="text-xs text-muted-foreground">Active subscribers</div>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="text-2xl font-bold">
            {members.filter((m) => m.last_active_at === null).length}
          </div>
          <div className="text-xs text-muted-foreground">Never logged in</div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left">Member</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-center">Tier</th>
                  <th className="px-3 py-2 text-center">Subscription</th>
                  <th className="px-3 py-2 text-center">Last Active</th>
                  <th className="px-3 py-2 text-center">Days Inactive</th>
                  <th className="px-3 py-2 text-left">Member Since</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
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
                        <span className="text-muted-foreground text-xs capitalize">{m.tier ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${subBadgeClass(m.sub_status)}`}>
                        {m.sub_status ?? "none"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-muted-foreground whitespace-nowrap">
                      {m.last_active_at ? formatDate(m.last_active_at) : <span className="text-red-500 font-medium">Never</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {m.days_inactive !== null ? (
                        <span className={`font-mono text-xs font-semibold ${m.days_inactive > 30 ? "text-red-500" : "text-amber-500"}`}>
                          {m.days_inactive}d
                        </span>
                      ) : (
                        <span className="text-red-500 font-mono text-xs font-semibold">—</span>
                      )}
                    </td>
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
