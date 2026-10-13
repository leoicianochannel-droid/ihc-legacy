import { db, users } from "@/lib/db";
import { eq, desc, sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { BetaInviteForm } from "./beta-invite-form";
import { ToggleBetaButton } from "./toggle-beta-button";

export const dynamic = "force-dynamic";

const AUTO_SLOTS = 10;
const AUTO_DAYS = 30;

export default async function BetaTestersPage() {
  const betaUsers = await db
    .select()
    .from(users)
    .where(eq(users.isBetaTester, true))
    .orderBy(desc(users.createdAt));

  // Count auto-enrolled testers (signup gave them 30d automatically)
  const [{ autoUsed }] = await db
    .select({ autoUsed: sql<number>`count(*)::int` })
    .from(users)
    .where(sql`${users.betaNote} LIKE 'auto-enrolled%'`);
  const autoCount = Number(autoUsed ?? 0);
  const autoRemaining = Math.max(0, AUTO_SLOTS - autoCount);

  const now = Date.now();

  return (
    <div className="container max-w-4xl py-8">
      <h1 className="font-display text-3xl font-bold">Beta Testers / Free Access</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The first {AUTO_SLOTS} people who sign up get {AUTO_DAYS} days of free access
        automatically. You can also manually grant access to specific members below.
      </p>

      {/* Auto-promo status card */}
      <Card className="mt-6 border-primary/30 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-primary">
                Auto-Enroll Promo Active
              </div>
              <div className="mt-1 font-display text-2xl font-bold">
                {autoCount} of {AUTO_SLOTS} slots used
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {autoRemaining > 0
                  ? `Next ${autoRemaining} signup${autoRemaining === 1 ? "" : "s"} will get ${AUTO_DAYS} days free access automatically.`
                  : "All 10 promo slots used. New signups won't get free access automatically — you'll need to grant manually below or have them subscribe."}
              </p>
            </div>
            <div className="font-display text-4xl font-bold text-primary">
              {autoRemaining}
              <span className="text-base font-normal text-muted-foreground"> left</span>
            </div>
          </div>
          <Progress value={(autoCount / AUTO_SLOTS) * 100} className="mt-3" />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Grant free access manually</CardTitle>
        </CardHeader>
        <CardContent>
          <BetaInviteForm />
          <div className="mt-4 rounded-xl bg-amber-50 p-4 text-xs text-amber-900">
            <strong>Note:</strong> Use this for specific members beyond the auto-enroll quota,
            or to grant a different duration. The user must already have signed up — share this
            URL first:{" "}
            <code className="break-all">
              https://infinity-hoop-community-green.vercel.app/sign-up
            </code>
          </div>
        </CardContent>
      </Card>

      <h2 className="mt-8 mb-3 font-display text-2xl font-bold">
        Active beta testers ({betaUsers.length})
      </h2>
      {betaUsers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No beta testers yet. Use the form above to add one.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Member</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Free access until</th>
                  <th className="p-3 text-left">Note</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {betaUsers.map((u) => {
                  const expired = u.freeAccessUntil
                    ? new Date(u.freeAccessUntil).getTime() < now
                    : false;
                  return (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="p-3">
                        <div className="font-semibold">
                          {u.firstName} {u.lastName}
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {u.tier}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs">{u.email}</td>
                      <td className="p-3 text-xs">
                        {u.freeAccessUntil ? (
                          <span className={expired ? "text-destructive font-semibold" : "text-foreground"}>
                            {formatDate(u.freeAccessUntil)}
                            {expired && " (expired — needs to subscribe)"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">No expiry set</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {u.betaNote ?? "—"}
                      </td>
                      <td className="p-3 text-right">
                        <ToggleBetaButton userId={u.id} email={u.email} isBeta={true} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
