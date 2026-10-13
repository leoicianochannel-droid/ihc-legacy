import Link from "next/link";
import { db, migrationRecords, users } from "@/lib/db";
import { eq, sql, isNotNull } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MigratePage() {
  const [totalRecords] = await db.select({ n: sql<number>`count(*)::int` }).from(migrationRecords);
  const [withUser] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(migrationRecords)
    .where(isNotNull(migrationRecords.userId));
  const [invited] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(migrationRecords)
    .where(isNotNull(migrationRecords.invitedAt));
  const [activated] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(migrationRecords)
    .where(isNotNull(migrationRecords.activatedAt));
  const [migratedUsers] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.migratedFromSkool, true));

  return (
    <div className="container max-w-3xl py-8">
      <h1 className="font-display text-3xl font-bold">Migrate from Skool</h1>
      <p className="text-sm text-muted-foreground">
        Three-step process. Run each step from the terminal so you can watch the output.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Records</CardTitle></CardHeader><CardContent className="text-3xl font-display font-bold">{totalRecords.n}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">User rows</CardTitle></CardHeader><CardContent className="text-3xl font-display font-bold">{migratedUsers.n}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Invited</CardTitle></CardHeader><CardContent className="text-3xl font-display font-bold">{invited.n}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Activated</CardTitle></CardHeader><CardContent className="text-3xl font-display font-bold">{activated.n}</CardContent></Card>
      </div>

      <Card className="mt-8">
        <CardHeader><CardTitle>Step 1 — Dry run</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Previews the CSV without writing anything.</p>
          <pre className="mt-3 rounded-xl bg-muted p-3 text-xs">npm run migrate:skool -- --dry-run</pre>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle>Step 2 — Import users</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Inserts users + migration_records for all rows.</p>
          <pre className="mt-3 rounded-xl bg-muted p-3 text-xs">npm run migrate:skool</pre>
          <p className="mt-3 text-xs text-muted-foreground">
            Limit to first 50 for testing: <code>npm run migrate:skool -- --limit 50</code>
          </p>
        </CardContent>
      </Card>

      <Card className="mt-4 border-primary/40 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-4 text-primary" />
            Step 3 — Send invites (batch picker)
          </CardTitle>
          <Badge variant="outline" className="w-fit">
            {(migratedUsers.n - invited.n).toLocaleString()} pending invite ·{" "}
            {invited.n.toLocaleString()} invited · {activated.n.toLocaleString()} claimed
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pick a cohort (loyalty, queue order, or specific emails), preview who
            you're sending to, then send. Safe to re-click — invited members are
            skipped on subsequent runs.
          </p>
          <Button asChild variant="gradient">
            <Link href="/admin/migrate/batch">Open batch picker →</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
