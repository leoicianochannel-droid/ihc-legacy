/**
 * Server-side email sending via Resend.
 *
 * All transactional email flows through `sendEmail()`. It:
 *  - No-ops gracefully when RESEND_API_KEY is missing (dev/preview builds
 *    don't need real keys, and we don't want to crash on a missing env var)
 *  - Logs failures to console and Sentry but never throws — email failures
 *    must not block the action that triggered them (welcome, password reset,
 *    invite, etc.)
 *  - Renders simple branded HTML so emails look like they came from us, not
 *    a developer's localhost
 *
 * Templates are kept inline (not React Email components) to avoid pulling in
 * a 200KB React rendering dependency just for transactional mail. Easy to
 * upgrade later if we need richer templates.
 */
import "server-only";
import { Resend } from "resend";

let cachedClient: Resend | null = null;
function getClient() {
  if (cachedClient) return cachedClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  cachedClient = new Resend(key);
  return cachedClient;
}

const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL || "Infinity Hoop <onboarding@resend.dev>";

const BRAND_PRIMARY = "#d10352";
const BRAND_BG = "#FAFAF7";
const BRAND_INK = "#0A0A0A";

export type EmailResult =
  | { ok: true; id: string }
  | { ok: false; reason: "no_key" | "send_failed"; error?: string };

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  /** Plain-text fallback. If omitted, we strip HTML tags from `html`. */
  text?: string;
  /** Optional from override; falls back to RESEND_FROM_EMAIL. */
  from?: string;
  /** Skips send and returns success if RESEND_DISABLE=1 — useful for dry-run testing. */
}): Promise<EmailResult> {
  const client = getClient();
  if (!client) {
    console.warn("[email] RESEND_API_KEY not configured — skipping send", {
      to: opts.to,
      subject: opts.subject,
    });
    return { ok: false, reason: "no_key" };
  }

  if (process.env.RESEND_DISABLE === "1") {
    console.log("[email] RESEND_DISABLE=1 — pretending to send", opts.subject);
    return { ok: true, id: "disabled" };
  }

  try {
    const res = await client.emails.send({
      from: opts.from ?? DEFAULT_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? opts.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    });
    if (res.error) {
      console.error("[email] Resend returned error", res.error);
      return { ok: false, reason: "send_failed", error: res.error.message };
    }
    return { ok: true, id: res.data?.id ?? "unknown" };
  } catch (err) {
    console.error("[email] send threw", err);
    return { ok: false, reason: "send_failed", error: (err as Error).message };
  }
}

/* ─────────────────────────── Templates ─────────────────────────── */

function shell(opts: { title: string; preheader?: string; bodyHtml: string }): string {
  // The "preheader" trick — a hidden first line of plain text shown in the
  // inbox preview, then padded with spaces so subsequent body text doesn't
  // leak into the preview. Genuine open-rate improvement.
  const preheader =
    opts.preheader ??
    "Move daily. Eat well. Show up for yourself. We're rooting for you.";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${escapeHtml(opts.title)}</title>
  </head>
  <body style="margin:0;background:${BRAND_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${BRAND_INK};">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;">${escapeHtml(preheader)}${" ".repeat(120)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND_BG};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <tr>
              <td style="background:${BRAND_PRIMARY};padding:20px 28px;color:#ffffff;font-weight:900;letter-spacing:1.5px;font-size:18px;">
                INFINITY&nbsp;HOOP
              </td>
            </tr>
            <tr>
              <td style="padding:28px;line-height:1.55;font-size:15px;color:${BRAND_INK};">
                ${opts.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px;border-top:1px solid #eee;font-size:12px;color:#6b7280;">
                You're getting this because you have an Infinity Hoop account.
                <br />
                <a href="https://members.infinityhoop.com/settings" style="color:${BRAND_PRIMARY};text-decoration:none;font-weight:600;">Notification settings</a>
                &nbsp;·&nbsp;
                <a href="https://members.infinityhoop.com/privacy" style="color:${BRAND_PRIMARY};text-decoration:none;font-weight:600;">Privacy</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:9999px;font-weight:700;font-size:15px;">${escapeHtml(label)}</a>`;
}

/* Welcome email — sent right after a new member completes onboarding. */
export function welcomeEmail(opts: { firstName: string; appUrl: string }): {
  subject: string;
  html: string;
} {
  const subject = `${opts.firstName}, you're in 💜 here's where to start`;
  const html = shell({
    title: subject,
    preheader: "Three things to do today + a free 45-day challenge inside",
    bodyHtml: `
      <h1 style="font-family:Georgia,serif;font-size:28px;margin:0 0 12px;font-weight:700;">
        Welcome, ${escapeHtml(opts.firstName)}!
      </h1>
      <p style="margin:0 0 16px;">
        We're so glad you're here. The community is a place where everyone
        gets what you're doing — and the workouts are designed for the woman
        who actually wants to show up daily, not the one with a 90-minute
        gym window.
      </p>
      <p style="margin:0 0 16px;font-weight:600;">Three things to do today:</p>
      <ol style="margin:0 0 20px;padding-left:20px;">
        <li style="margin-bottom:8px;">Watch your first workout on the <a href="${opts.appUrl}/dashboard" style="color:${BRAND_PRIMARY};font-weight:600;">Today dashboard</a></li>
        <li style="margin-bottom:8px;">Save tonight's recipe and add it to your grocery list</li>
        <li style="margin-bottom:8px;">Join the <a href="${opts.appUrl}/challenges/45-day-challenge" style="color:${BRAND_PRIMARY};font-weight:600;">45-Day Challenge</a> — it's the fastest way to actually see results</li>
      </ol>
      <p style="margin:0 0 24px;text-align:center;">${button(`${opts.appUrl}/dashboard`, "Open my dashboard →")}</p>
      <p style="margin:0;font-size:13px;color:#6b7280;">
        Reply to this email if you have any questions — it goes straight to
        a real person on our team.
      </p>
    `,
  });
  return { subject, html };
}

/* Member invite — sent when an admin adds someone from /admin/members. */
export function memberInviteEmail(opts: {
  firstName: string | null;
  email: string;
  appUrl: string;
  freeAccessUntil: Date | null;
}): { subject: string; html: string } {
  const name = opts.firstName?.trim() || null;
  const subject = name
    ? `${name}, you've been added to the Infinity Hoop community 💜`
    : "You've been added to the Infinity Hoop community 💜";
  const forever =
    opts.freeAccessUntil != null && opts.freeAccessUntil.getUTCFullYear() >= 2099;
  const accessLine = opts.freeAccessUntil
    ? forever
      ? `<p style="margin:0 0 16px;">Your membership is <strong>on us</strong>. No subscription needed.</p>`
      : `<p style="margin:0 0 16px;">You have <strong>free access through ${escapeHtml(
          opts.freeAccessUntil.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          }),
        )}</strong>.</p>`
    : "";
  const signUpUrl = `${opts.appUrl}/sign-up`;
  const html = shell({
    title: subject,
    preheader: "Your spot is ready. Create your account to get started.",
    bodyHtml: `
      <h1 style="font-family:Georgia,serif;font-size:28px;margin:0 0 12px;font-weight:700;">
        ${name ? `Welcome, ${escapeHtml(name)}!` : "Welcome!"}
      </h1>
      <p style="margin:0 0 16px;">
        Our team added you to the Infinity Hoop community: daily workouts,
        recipes, challenges and a group of women who get what you're doing.
      </p>
      ${accessLine}
      <p style="margin:0 0 16px;">
        Create your account with <strong>${escapeHtml(opts.email)}</strong> so we
        can match it to your spot.
      </p>
      <p style="margin:0 0 24px;text-align:center;">${button(signUpUrl, "Create my account →")}</p>
      <p style="margin:0;font-size:13px;color:#6b7280;">
        Reply to this email if you have any questions. It goes straight to
        a real person on our team.
      </p>
    `,
  });
  return { subject, html };
}

/* Beta-expiry reminder — 7 days before free access ends. */
export function betaExpiringEmail(opts: {
  firstName: string;
  appUrl: string;
  endsOn: string;
}): { subject: string; html: string } {
  const subject = `${opts.firstName}, your beta access ends ${opts.endsOn}`;
  const html = shell({
    title: subject,
    preheader: "Keep your spot for $39.99/mo. Locks in beta-tester pricing forever.",
    bodyHtml: `
      <h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 12px;font-weight:700;">
        Heads up, ${escapeHtml(opts.firstName)}.
      </h1>
      <p style="margin:0 0 16px;">
        Your free beta access ends on <strong>${escapeHtml(opts.endsOn)}</strong>.
        We've loved having you test the platform — your feedback shaped a lot
        of what's now live.
      </p>
      <p style="margin:0 0 16px;">
        If you want to keep your daily workouts, recipes, the 45-Day Challenge,
        and the community, subscribe today and we'll lock in beta pricing for
        you for life.
      </p>
      <p style="margin:0 0 24px;text-align:center;">${button(`${opts.appUrl}/upgrade`, "Subscribe and keep going →")}</p>
      <p style="margin:0;font-size:13px;color:#6b7280;">
        Not ready? No hard feelings. You'll keep access through ${escapeHtml(opts.endsOn)} either way.
      </p>
    `,
  });
  return { subject, html };
}

/* Challenge weekly progress — sent every Monday to active challenge members. */
export function challengeProgressEmail(opts: {
  firstName: string;
  appUrl: string;
  challengeName: string;
  daysCompleted: number;
  totalDays: number;
  weekNumber: number;
  currentDay: number;
}): { subject: string; html: string } {
  const { firstName, appUrl, challengeName, daysCompleted, totalDays, weekNumber, currentDay } = opts;
  const pct = Math.round((daysCompleted / totalDays) * 100);
  const daysLeft = totalDays - daysCompleted;

  let headline: string;
  let message: string;
  if (daysCompleted === 0) {
    headline = `Week ${weekNumber} is here — time to start moving, ${escapeHtml(firstName)}!`;
    message = `You joined the ${escapeHtml(challengeName)} but haven't checked in yet. There's no better time than today — even one session puts you on the board.`;
  } else if (pct < 40) {
    headline = `${daysCompleted} days down — you're building real momentum, ${escapeHtml(firstName)}.`;
    message = `The first stretch of any challenge is about forming the habit. You've shown up ${daysCompleted} time${daysCompleted !== 1 ? "s" : ""} already — that's not nothing. Keep going.`;
  } else if (pct < 60) {
    headline = `Halfway there, ${escapeHtml(firstName)}! ${daysCompleted} of ${totalDays} days done.`;
    message = `You're right in the middle — this is where most people slow down. Not you. ${daysLeft} days left and the habit is already forming.`;
  } else if (pct < 85) {
    headline = `${escapeHtml(firstName)}, you've done ${daysCompleted} of ${totalDays} days. The finish line is close.`;
    message = `You're past the hard part. ${daysLeft} day${daysLeft !== 1 ? "s" : ""} to go — you'd be crazy to stop now.`;
  } else {
    headline = `Almost done, ${escapeHtml(firstName)} — ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left!`;
    message = `${daysCompleted} days completed. You are so close to finishing the ${escapeHtml(challengeName)}. Don't let up now.`;
  }

  const filledWidth = Math.max(4, pct);
  const subject = daysCompleted === 0
    ? `Week ${weekNumber} of your challenge — ready to start?`
    : `Week ${weekNumber} update: ${daysCompleted} of ${totalDays} days done 💪`;

  const html = shell({
    title: subject,
    preheader: `${daysCompleted} of ${totalDays} days complete — ${daysLeft} to go. You've got this.`,
    bodyHtml: `
      <h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 12px;font-weight:700;line-height:1.3;">
        ${headline}
      </h1>
      <p style="margin:0 0 20px;">${message}</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
        <tr>
          <td style="background:#f3f4f6;border-radius:9999px;height:12px;overflow:hidden;padding:0;">
            <div style="width:${filledWidth}%;height:12px;background:${BRAND_PRIMARY};border-radius:9999px;"></div>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 24px;font-size:13px;color:#6b7280;text-align:right;">${daysCompleted} / ${totalDays} days &nbsp;·&nbsp; ${pct}%</p>

      <p style="margin:0 0 24px;text-align:center;">${button(`${appUrl}/challenges/30-day-challenge`, `Log Day ${currentDay} →`)}</p>

      <p style="margin:0;font-size:13px;color:#6b7280;">
        Questions or feedback? Reply to this email — it goes straight to a real person.
      </p>
    `,
  });
  return { subject, html };
}

/* Streak-at-risk — sent on days when a member with current > 0 hasn't logged an action by 6pm local. */
export function streakAtRiskEmail(opts: {
  firstName: string;
  appUrl: string;
  currentStreak: number;
}): { subject: string; html: string } {
  const subject = `${opts.firstName}, save your ${opts.currentStreak}-day streak 🔥`;
  const html = shell({
    title: subject,
    preheader: "20 minutes today keeps it alive. You've come too far to stop now.",
    bodyHtml: `
      <h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 12px;font-weight:700;">
        Hey ${escapeHtml(opts.firstName)} — quick one.
      </h1>
      <p style="margin:0 0 16px;">
        Your <strong>${opts.currentStreak}-day streak</strong> is still alive,
        but you haven't logged anything today yet. 20 minutes with the hoop
        keeps it going.
      </p>
      <p style="margin:0 0 24px;text-align:center;">${button(`${opts.appUrl}/workouts`, "Start today's workout →")}</p>
      <p style="margin:0;font-size:13px;color:#6b7280;">
        You've got freeze tokens too — we'll auto-use one if you absolutely
        can't move tonight, but showing up beats spending every time.
      </p>
    `,
  });
  return { subject, html };
}
