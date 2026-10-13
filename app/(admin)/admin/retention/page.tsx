import { db, users } from "@/lib/db";
import { sql } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertTriangle, TrendingDown, Clock } from "lucide-react";
import { NudgeButton } from "./nudge-button";
import { relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TIERS = [
  { label: "30+ days inactive", days: 30, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30", badge: "secondary" as const },
  { label: "14–29 days inactive", days: 14, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30", badge: "secondary" as const },
  { label: "7–13 days inactive", days: 7, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/30", badge: "outline" as const },
];

type MemberRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  avatarUrl: string | null;
  lastActivityAt: Date | null;
  onboardedAt: Date | null;
};

export default async function RetentionPage() {
  // Last activity per active member
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get all active members with their last activity date
  const rows = await db.execute<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    avatar_url: string | null;
    last_activity_at: Date | null;
    onboarded_at: Date | null;
  }>(sql`
    SELECT
      u.id,
      u.first_name,
      u.last_name,
      u.email,
      u.avatar_url,
      MAX(al.created_at) AS last_activity_at,
      u.onboarded_at
    FROM users u
    LEFT JOIN activity_log al ON al.user_id = u.id
    WHERE
      u.clerk_id IS NOT NULL
      AND u.onboarded_at IS NOT NULL
      AND u.role = 'member'
    GROUP BY u.id
    HAVING MAX(al.created_at) < ${sevenDaysAgo} OR MAX(al.created_at) IS NULL
    ORDER BY last_activity_at ASC NULLS FIRST
    LIMIT 500
  `);

  const members = (rows as unknown as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    avatar_url: string | null;
    last_activity_at: Date | null;
    onboarded_at: Date | null;
  }>).map((r) => ({
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    avatarUrl: r.avatar_url,
    lastActivityAt: r.last_activity_at ? new Date(r.last_activity_at) : null,
    onboardedAt: r.onboarded_at ? new Date(r.onboarded_at) : null,
  }));

  function daysSince(date: Date | null) {
    if (!date) return 999;
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  }

  const tier30 = members.filter((m) => daysSince(m.lastActivityAt) >= 30);
  const tier14 = members.filter((m) => { const d = daysSince(m.lastActivityAt); return d >= 14 && d < 30; });
  const tier7  = members.filter((m) => { const d = daysSince(m.lastActivityAt); return d >= 7  && d < 14; });

  const tiers = [
    { ...TIERS[0], members: tier30 },
    { ...TIERS[1], members: tier14 },
    { ...TIERS[2], members: tier7 },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Churn Risk</h1>
        <p className="mt-1 text-muted-foreground">
          Active members who have gone quiet — sorted by how long since their last activity.
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        {[
          { label: "30+ days", count: tier30.length, icon: AlertTriangle, color: "text-red-500" },
          { label: "14–29 days", count: tier14.length, icon: TrendingDown, color: "text-amber-500" },
          { label: "7–13 days", count: tier7.length, icon: Clock, color: "text-yellow-500" },
        ].map(({ label, count, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-4">
              <Icon className={`size-6 shrink-0 ${color}`} />
              <div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tier lists */}
      <div className="space-y-8">
        {tiers.map((tier) => (
          <section key={tier.label}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="font-display text-lg font-bold">{tier.label}</h2>
              <Badge variant={tier.badge}>{tier.members.length}</Badge>
            </div>

            {tier.members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members in this range. 🎉</p>
            ) : (
              <Card>
                <div className="divide-y">
                  {tier.members.map((m) => {
                    const days = daysSince(m.lastActivityAt);
                    const name = [m.firstName, m.lastName].filter(Boolean).join(" ") || "Unknown";
                    return (
                      <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                        <Avatar className="size-8 shrink-0">
                          <AvatarImage src={m.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-xs font-bold">
                            {m.firstName?.slice(0, 1) ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{name}</p>
                          <p className="text-xs text-muted-foreground truncate">{m.email ?? "—"}</p>
                        </div>
                        <div className="text-right shrink-0 mr-3">
                          <p className={`text-xs font-semibold ${tier.color}`}>
                            {m.lastActivityAt ? `${days}d ago` : "Never active"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {m.lastActivityAt ? relativeTime(m.lastActivityAt) : "No activity logged"}
                          </p>
                        </div>
                        <NudgeButton
                          memberId={m.id}
                          memberEmail={m.email}
                          memberFirstName={m.firstName}
                        />
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
