import Link from "next/link";
import { db, users, migrationRecords } from "@/lib/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { BatchSendForm } from "./batch-send-form";

export const dynamic = "force-dynamic";

export default async function MigrationBatchPicker() {
  const [{ totalMigrated }] = await db
    .select({ totalMigrated: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.migratedFromSkool, true));

  const [{ pending }] = await db
    .select({ pending: sql<number>`count(*)::int` })
    .from(users)
    .innerJoin(migrationRecords, eq(migrationRecords.userId, users.id))
    .where(and(eq(users.migratedFromSkool, true), isNull(migrationRecords.invitedAt)));

  const [{ invited }] = await db
    .select({ invited: sql<number>`count(*)::int` })
    .from(migrationRecords)
    .where(sql`${migrationRecords.invitedAt} IS NOT NULL`);

  const [{ activated }] = await db
    .select({ activated: sql<number>`count(*)::int` })
    .from(migrationRecords)
    .where(sql`${migrationRecords.activatedAt} IS NOT NULL`);

  // Claim rate among invited
  const claimRate =
    Number(invited) > 0 ? Math.round((Number(activated) / Number(invited)) * 1000) / 10 : 0;

  return (
    <div className="container max-w-3xl py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/admin/migrate"><ChevronLeft /> Back to migration overview</Link>
      </Button>

      <h1 className="font-display text-3xl font-bold">Send migration batch</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick a cohort, preview who's in it, then send. Re-callable safely — invited
        members are skipped on subsequent runs.
      </p>

      {/* Status snapshot */}
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Migrated" value={Number(totalMigrated)} />
        <Stat label="Pending invite" value={Number(pending)} tone={pending > 0 ? "warn" : "ok"} />
        <Stat label="Invited" value={Number(invited)} />
        <Stat label="Claimed" value={`${claimRate}%`} sub={`${activated} of ${invited}`} />
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Pick a cohort and send</CardTitle>
        </CardHeader>
        <CardContent>
          <BatchSendForm pending={Number(pending)} />
        </CardContent>
      </Card>

      <Card className="mt-4 border-amber-300 bg-amber-50">
        <CardContent className="p-5 text-sm">
          <p className="font-semibold">Before sending the first real batch:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900">
            <li>Resend domain verified (DKIM/SPF DNS records on your real domain)</li>
            <li>Real domain pointing at Vercel, <code>NEXT_PUBLIC_APP_URL</code> updated</li>
            <li>Clerk on production (<code>pk_live_*</code>) keys</li>
            <li>One pilot batch (~20) to your own beta testers before any cohort</li>
          </ul>
          <p className="mt-3 text-xs text-amber-900">
            Check status on{" "}
            <Link href="/admin/webhooks" className="font-semibold underline">
              /admin/webhooks
            </Link>{" "}
            — every row should be green or amber, not red.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "neutral" | "ok" | "warn";
}) {
  const color =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className={`mt-1 font-display text-2xl font-bold ${color}`}>{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
