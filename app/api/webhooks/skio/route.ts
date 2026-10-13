import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db, users, subscriptions } from "@/lib/db";
import { eq } from "drizzle-orm";
import { sendEmail, welcomeEmail } from "@/lib/email";
import { findSubscriptionsByEmail } from "@/lib/skio";
import { getAppUrl } from "@/lib/app-url";

export const runtime = "nodejs";

/**
 * Skio webhook handler.
 *
 * Skio fires events for every subscription state change. We listen for the
 * ones that affect access:
 *   - subscription.created    → grant access (free trial starts here too)
 *   - subscription.activated  → ensure access
 *   - subscription.cancelled  → revoke access at period end
 *   - subscription.expired    → revoke access immediately
 *   - subscription.failed     → mark past_due (we still grant 7-day grace)
 *
 * Signature verification: Skio signs each webhook with HMAC-SHA256 using
 * the secret you configure in their dashboard. The signature is in the
 * "X-Skio-Signature" header.
 *
 * Configure: Skio dashboard → Settings → Webhooks → add endpoint pointing
 * to https://members.infinityhoop.com/api/webhooks/skio (or whatever your
 * deployed URL is). Copy the signing secret into SKIO_WEBHOOK_SECRET env var.
 */
/**
 * Verify a Skio webhook. Skio's "token" can arrive in several places:
 *   1. As an HMAC-SHA256 signature in `X-Skio-Signature` (older API style)
 *   2. As a bearer/plain token in a header — common ones: `X-Webhook-Token`,
 *      `X-Skio-Token`, `Authorization: Bearer <token>`
 *   3. Inside the JSON body as `token` or `webhookToken`
 *   4. As a `?token=` query string parameter
 *
 * We accept the request if ANY of these methods produces a match against
 * SKIO_WEBHOOK_SECRET, using a constant-time string compare. Defensive
 * coding — Skio's format isn't fully documented and we'd rather work than
 * 401 every webhook.
 */
function verifySkio(opts: {
  secret: string;
  signature: string | null;
  headers: Record<string, string | null>;
  url: URL;
  body: string;
  parsedBody: unknown;
}): boolean {
  const { secret, signature, headers, url, body, parsedBody } = opts;

  // 1. HMAC signature path
  if (signature) {
    try {
      const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
      const sig = signature.replace(/^sha256=/, "");
      if (
        sig.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
      ) {
        return true;
      }
    } catch {
      // fall through to other methods
    }
  }

  // 2. Token-in-header — check the common header names
  const candidates: Array<string | null> = [
    headers["x-webhook-token"],
    headers["x-skio-token"],
    headers["x-skio-webhook-token"],
    headers["webhook-token"],
  ];
  const authz = headers["authorization"];
  if (authz) candidates.push(authz.replace(/^Bearer\s+/i, "").trim());
  for (const c of candidates) {
    if (c && safeEqual(c, secret)) return true;
  }

  // 3. Token in JSON body. Skio's actual key is `skioWebhookToken` (verified
  //    against the live payloads landing in production — see Skio help docs
  //    "Webhooks" article). We also accept several legacy/alternate names in
  //    case Skio ever shifts naming, so this layer is forgiving.
  if (parsedBody && typeof parsedBody === "object") {
    const o = parsedBody as Record<string, unknown>;
    for (const k of [
      "skioWebhookToken",
      "token",
      "webhookToken",
      "webhook_token",
      "secret",
    ]) {
      const v = o[k];
      if (typeof v === "string" && safeEqual(v, secret)) return true;
    }
  }

  // 4. Token in URL query
  const qToken = url.searchParams.get("token");
  if (qToken && safeEqual(qToken, secret)) return true;

  return false;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Skio's actual webhook payload shape (per their public event reference).
 * The "Subscription created" event looks like:
 *   {
 *     "eventType": "Subscription created",
 *     "eventData": {
 *       "subscriptionId": "...",
 *       "timestamp": "...",
 *       "userCognitoUsername": "...",
 *       "userEmail": "...",
 *       "userType": "..."
 *     },
 *     "domain": "...",
 *     "subscriptionId": "..."
 *   }
 *
 * Other event types use the same shape with a different `eventType` and may
 * include additional fields in `eventData` (status, currentPeriodEnd, etc).
 * We also tolerate the older Stripe-style schema in case Skio changes things.
 */
type SkioWebhookPayload = {
  // Skio canonical
  eventType?: string;                   // "Subscription created" | "Subscription cancelled" | ...
  /** Per Skio docs: the signing token Skio includes in every payload. Verify
   *  this matches SKIO_WEBHOOK_SECRET. Checked in verifySkio() above. */
  skioWebhookToken?: string;
  eventData?: {
    subscriptionId?: string;
    timestamp?: string;
    userEmail?: string | null;
    userCognitoUsername?: string | null;
    userType?: string;
    status?: string;                    // present on some events
    currentPeriodEnd?: string;
    cancelAt?: string | null;
    trialEndsAt?: string | null;
    customerId?: string;
  };
  domain?: string;
  subscriptionId?: string;

  // Backwards-compat with older Skio schemas (Stripe-style) so we don't
  // need to redeploy if their format shifts.
  topic?: string;
  type?: string;
  data?: {
    id?: string;
    status?: string;
    customer?: { email?: string; id?: string };
    storefrontUser?: { email?: string; emailLower?: string };
    subscription?: {
      id?: string;
      status?: string;
      currentPeriodEnd?: string;
      cancelAt?: string | null;
      trialEndsAt?: string | null;
    };
  };
  id?: string;
  status?: string;
};

function extractEmail(p: SkioWebhookPayload): string | null {
  const e =
    p.eventData?.userEmail ||
    p.data?.customer?.email ||
    p.data?.storefrontUser?.emailLower ||
    p.data?.storefrontUser?.email ||
    null;
  return e?.toLowerCase() ?? null;
}

function extractSkioId(p: SkioWebhookPayload): string | null {
  return (
    p.eventData?.subscriptionId ||
    p.subscriptionId ||
    p.data?.subscription?.id ||
    p.data?.id ||
    p.id ||
    null
  );
}

/**
 * Infer a status from Skio's human-readable eventType when an explicit
 * status field isn't provided. e.g. "Subscription cancelled" → "canceled".
 */
function inferStatusFromEventType(eventType: string | undefined): string | undefined {
  if (!eventType) return undefined;
  const lc = eventType.toLowerCase();
  if (lc.includes("created") || lc.includes("activated")) return "ACTIVE";
  if (lc.includes("trialing") || lc.includes("trial")) return "TRIALING";
  if (lc.includes("cancel") || lc.includes("expired")) return "CANCELLED";
  if (lc.includes("paused") || lc.includes("failed") || lc.includes("past_due")) return "PAUSED";
  return undefined;
}

function mapSkioStatusToOurs(
  status: string | undefined
): "active" | "trialing" | "canceled" | "past_due" | "incomplete" | "unpaid" {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "TRIALING":
    case "TRIAL":
      return "trialing";
    case "CANCELLED":
    case "CANCELED":
    case "EXPIRED":
      return "canceled";
    case "PAUSED":
    case "FAILED":
    case "PAYMENT_FAILED":
      return "past_due";
    default:
      return "incomplete";
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.SKIO_WEBHOOK_SECRET?.trim();
  const sig = req.headers.get("x-skio-signature") || req.headers.get("X-Skio-Signature");
  const body = await req.text();

  // Try to parse the body once — verifySkio also checks for the token inside
  // the JSON, so we need it parsed up front.
  let payload: SkioWebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Collect normalized headers for the verifier
  const headerSnapshot: Record<string, string | null> = {};
  req.headers.forEach((value, key) => {
    headerSnapshot[key.toLowerCase()] = value;
  });

if (secret) {
    const ok = verifySkio({
      secret,
      signature: sig,
      headers: headerSnapshot,
      url: new URL(req.url),
      body,
      parsedBody: payload,
    });
    if (!ok) {
      console.error("Skio webhook verification failed", {
        hasSigHeader: !!sig,
        headerKeys: Object.keys(headerSnapshot).filter((k) => k.includes("token") || k.includes("sig") || k === "authorization"),
      });
      return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    }
  } else {
    console.warn("SKIO_WEBHOOK_SECRET not configured — accepting webhook without verification");
  }

  const topic = payload.eventType || payload.topic || payload.type || "";
  const email = extractEmail(payload);
  const skioId = extractSkioId(payload);
  const status =
    payload.eventData?.status ||
    payload.data?.subscription?.status ||
    payload.data?.status ||
    payload.status ||
    // Last-resort fallback — derive from the event name itself
    inferStatusFromEventType(payload.eventType);

  if (!email || !skioId) {
    console.warn("Skio webhook missing email or subscription id — ignoring", { topic });
    return NextResponse.json({ ok: true, reason: "missing_data" });
  }

  // Find or create the user by email — Skio is the source of truth, but our
  // user might not exist yet if they bought before signing up on the new platform.
  // `isBrandNewUser` gates the welcome email below — we only want to send it
  // once, on the very first event for a fresh buyer.
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const isBrandNewUser = !u;
  if (!u) {
    // Pre-create a user row so when they sign up later, they're auto-linked
    await db.insert(users).values({ email, role: "member" });
    console.log(`Skio webhook: created shadow user for ${email}`);
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return NextResponse.json({ error: "user_create_failed" }, { status: 500 });

  // Upsert subscription row by skioSubscriptionId
  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.skioSubscriptionId, skioId))
    .limit(1);

  const ourStatus = mapSkioStatusToOurs(status);

  const periodEnd =
    payload.eventData?.currentPeriodEnd ?? payload.data?.subscription?.currentPeriodEnd;
  const cancelAt = payload.eventData?.cancelAt ?? payload.data?.subscription?.cancelAt;
  const trialEnd = payload.eventData?.trialEndsAt ?? payload.data?.subscription?.trialEndsAt;

  const values = {
    userId: user.id,
    skioSubscriptionId: skioId,
    shopifyCustomerId: payload.eventData?.customerId ?? payload.data?.customer?.id ?? null,
    status: ourStatus,
    plan: "monthly" as const, // single tier today
    currentPeriodEnd: periodEnd ? new Date(periodEnd) : null,
    cancelAt: cancelAt ? new Date(cancelAt) : null,
    trialEndsAt: trialEnd ? new Date(trialEnd) : null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(subscriptions).set(values).where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values({ ...values, createdAt: new Date() });
  }

  // Welcome email — fire once per buyer, on their first "created" event.
  //
  // Gate: !existing (no prior subscription row) AND a "created" topic AND active.
  // Using !existing is more accurate than isBrandNewUser — it handles the case
  // where a Clerk signup created the user row BEFORE the Skio webhook succeeded
  // (e.g. webhook was broken and buyer signed up manually in the meantime).
  // isBrandNewUser is still used to pre-create the shadow user above.
  //
  // This ensures:
  //   - First-ever webhook for this buyer → subscription row didn't exist → send
  //   - Skio retries of the same event → row now exists → skip (no double-send)
  //   - Status-change events (cancelled, paused) → not a "created" event → skip
  // We also wrap in try/catch so an email failure never 500s the webhook.
  const isCreatedEvent = /created/i.test(topic);
  if (!existing && isCreatedEvent && ourStatus === "active") {
    try {
      // Look up the buyer's first name from Skio's GraphQL so the email feels
      // personal instead of "Hey there." Best-effort — if Skio is slow or the
      // lookup fails, we fall back to a generic greeting.
      let firstName = "there";
      try {
        const subs = await findSubscriptionsByEmail(email);
        const fn = subs[0]?.StorefrontUser?.firstName?.trim();
        if (fn) firstName = fn;
      } catch (err) {
        console.warn("Skio webhook: firstName lookup failed, using fallback", err);
      }

      const { subject, html } = welcomeEmail({ firstName, appUrl: getAppUrl() });
      const result = await sendEmail({ to: email, subject, html });
      if (result.ok) {
        console.log(`Skio webhook: welcome email sent to ${email} (id: ${result.id})`);
      } else {
        console.warn(`Skio webhook: welcome email NOT sent to ${email}`, result);
      }
    } catch (err) {
      console.error("Skio webhook: welcome email threw", err);
    }
  }

  console.log(`Skio webhook handled: ${topic} for ${email} (status: ${ourStatus})`);
  return NextResponse.json({ ok: true });
}
