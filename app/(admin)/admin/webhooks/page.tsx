import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { db, subscriptions } from "@/lib/db";
import { desc, sql } from "drizzle-orm";
import { formatDate } from "@/lib/utils";
import { getAppUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

/**
 * Webhook + integration diagnostics. Lets an admin verify, at a glance, that
 * Skio / Resend / Sentry are configured before a launch event. Read-only
 * page — no secret values are ever displayed.
 */
export default async function WebhookDiagnosticsPage() {
  const checks: { name: string; ok: boolean; detail: string; warn?: boolean }[] = [
    {
      name: "Skio API key",
      ok: !!process.env.SKIO_API_KEY,
      detail: process.env.SKIO_API_KEY
        ? "Configured — used to sync subscriptions on signup."
        : "Missing — existing payers won't auto-link on signup.",
    },
    {
      name: "Skio webhook secret",
      ok: !!process.env.SKIO_WEBHOOK_SECRET,
      warn: !process.env.SKIO_WEBHOOK_SECRET,
      detail: process.env.SKIO_WEBHOOK_SECRET
        ? "Configured — webhook signatures will be verified."
        : "Missing — webhooks are accepted unverified. Sign up a webhook in Skio's dashboard and paste the secret here.",
    },
    {
      name: "Resend API key",
      ok: !!process.env.RESEND_API_KEY,
      detail: process.env.RESEND_API_KEY
        ? "Configured — transactional email is live."
        : "Missing — welcome / beta-expiry / streak emails will silently no-op until set.",
    },
    {
      name: "Resend from address",
      ok: !!process.env.RESEND_FROM_EMAIL,
      detail: process.env.RESEND_FROM_EMAIL
        ? `Sending as: ${process.env.RESEND_FROM_EMAIL}`
        : "Missing — defaults to onboarding@resend.dev (deliverability not great).",
    },
    {
      name: "Sentry DSN",
      ok: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
      detail: process.env.NEXT_PUBLIC_SENTRY_DSN
        ? "Configured — errors are being captured."
        : "Missing — runtime errors are NOT being captured.",
    },
    {
      name: "VAPID keys (push)",
      ok: !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
      detail:
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
          ? "Configured — push notifications can be sent."
          : "Missing — Settings > Notifications won't work.",
    },
    {
      name: "Vercel Blob",
      ok: !!process.env.BLOB_READ_WRITE_TOKEN,
      detail: process.env.BLOB_READ_WRITE_TOKEN
        ? "Configured — photo + PDF uploads work."
        : "Missing — community photo uploads will fail.",
    },
    {
      name: "Clerk (auth)",
      ok: !!(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
      warn: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_"),
      detail: process.env.CLERK_SECRET_KEY
        ? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")
          ? "⚠ Using TEST keys — switch to pk_live_* before bulk migration."
          : "Live keys configured."
        : "Missing — auth won't work.",
    },
  ];

  // Recent subscription rows — quick sanity check that webhooks have actually
  // been firing into the table.
  const recentSubs = await db
    .select({
      status: subscriptions.status,
      updatedAt: subscriptions.updatedAt,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .orderBy(desc(subscriptions.updatedAt))
    .limit(10);

  const [{ totalSubs }] = await db
    .select({ totalSubs: sql<number>`count(*)::int` })
    .from(subscriptions);

  const skioWebhookUrl = `${getAppUrl()}/api/webhooks/skio`;

  return (
    <div className="container max-w-4xl space-y-6 py-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Integration health</h1>
        <p className="text-sm text-muted-foreground">
          Pre-launch checklist. Anything red below needs to be fixed before
          you migrate Skool members.
        </p>
      </div>

      {/* Env check table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Environment variables</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {checks.map((c) => (
            <div key={c.name} className="flex items-start gap-3 py-3">
              {c.ok ? (
                c.warn ? (
                  <AlertTriangle className="size-5 shrink-0 text-amber-500" />
                ) : (
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
                )
              ) : (
                <XCircle className="size-5 shrink-0 text-rose-500" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{c.name}</span>
                  {c.ok && !c.warn && <Badge className="text-[10px]">OK</Badge>}
                  {c.warn && (
                    <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-800">
                      Warning
                    </Badge>
                  )}
                  {!c.ok && (
                    <Badge variant="outline" className="border-rose-300 text-[10px] text-rose-700">
                      Missing
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{c.detail}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Skio webhook setup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Skio webhook setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            In Skio dashboard → <strong>Settings → Webhooks</strong>, add a
            new endpoint pointing at:
          </p>
          <code className="block rounded-xl bg-muted px-3 py-2 text-xs">
            {skioWebhookUrl}
          </code>
          <p>
            Subscribe to these events:{" "}
            <code>subscription.created</code>,{" "}
            <code>subscription.activated</code>,{" "}
            <code>subscription.cancelled</code>,{" "}
            <code>subscription.expired</code>,{" "}
            <code>subscription.failed</code>.
          </p>
          <p>
            Copy the signing secret Skio gives you and paste it into the{" "}
            <code>SKIO_WEBHOOK_SECRET</code> environment variable on Vercel.
            Without that secret, webhooks are accepted unverified — fine for
            testing, not for production.
          </p>
        </CardContent>
      </Card>

      {/* Recent webhook traffic */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Subscription activity ({totalSubs} total)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Last 10 rows updated. Empty after a fresh deploy = webhooks not
            firing yet.
          </p>
        </CardHeader>
        <CardContent>
          {recentSubs.length === 0 ? (
            <p className="rounded-xl border border-dashed py-6 text-center text-sm text-muted-foreground">
              No subscription records yet. Once Skio webhooks fire, rows will
              appear here.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {recentSubs.map((s, i) => (
                <li key={i} className="flex items-center justify-between border-b py-2 last:border-0">
                  <Badge variant="outline" className="capitalize">
                    {s.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Updated {formatDate(s.updatedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
