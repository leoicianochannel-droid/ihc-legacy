import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, users, migrationRecords } from "@/lib/db";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { sendEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";

const HARD_BATCH_LIMIT = 200; // never send more than this in one request

/**
 * Sends branded welcome-back invites to migrated Skool members.
 *
 * Accepts a JSON body so the batch-picker page can choose:
 *   - cohort: "oldest_skool" | "newest_skool" | "queue" (default)
 *   - limit:  1..HARD_BATCH_LIMIT  (default 100)
 *   - emails: explicit string[] — overrides cohort, used for pilot batch
 *   - dryRun: true → preview which addresses WOULD be invited, send nothing
 *
 * Always skips users where `migrationRecords.invitedAt IS NOT NULL`, so the
 * endpoint can be re-called safely.
 */

type Body = {
  cohort?: "oldest_skool" | "newest_skool" | "queue";
  limit?: number;
  emails?: string[];
  dryRun?: boolean;
};

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    // accept empty body — fall back to defaults
  }

  const limit = Math.min(HARD_BATCH_LIMIT, Math.max(1, body.limit ?? 100));
  const cohort = body.cohort ?? "queue";
  const explicitEmails = body.emails?.map((e) => e.trim().toLowerCase()).filter(Boolean);
  const dryRun = !!body.dryRun;

  // ── Pick the batch ──────────────────────────────────────────────
  // Always join users → migration_records and skip anyone already invited.
  const baseFilter = and(
    eq(users.migratedFromSkool, true),
    isNull(migrationRecords.invitedAt)
  );

  let cohortFilter = baseFilter;
  if (explicitEmails && explicitEmails.length > 0) {
    // Explicit email list — used for the pilot batch. Limit isn't applied
    // here; the caller decides exactly who.
    cohortFilter = and(baseFilter, inArray(users.email, explicitEmails));
  }

  // Sort depending on cohort selection
  const orderBy =
    cohort === "oldest_skool"
      ? asc(users.skoolJoinedAt)
      : cohort === "newest_skool"
        ? desc(users.skoolJoinedAt)
        : asc(migrationRecords.createdAt); // queue = import order

  const batch = await db
    .select({
      userId: users.id,
      email: users.email,
      firstName: users.firstName,
      migrationId: migrationRecords.id,
    })
    .from(users)
    .innerJoin(migrationRecords, eq(migrationRecords.userId, users.id))
    .where(cohortFilter)
    .orderBy(orderBy)
    .limit(explicitEmails && explicitEmails.length > 0 ? explicitEmails.length : limit);

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      preview: batch.map((b) => ({ email: b.email, firstName: b.firstName })),
      count: batch.length,
    });
  }

  const client = await clerkClient();
  const origin = getAppUrl();
  let sent = 0;
  let skippedAlreadyActive = 0;
  const failures: { email: string; error: string }[] = [];

  // Process in small parallel buckets to respect Clerk's rate limits
  // while still being much faster than sequential.
  const CONCURRENCY = 5;
  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const bucket = batch.slice(i, i + CONCURRENCY);
    await Promise.all(
      bucket.map(async (row) => {
        try {
          // If the user already activated (clerkId is set), just mark them
          // invited without creating a Clerk invitation (would error anyway).
          const [freshUser] = await db
            .select({ clerkId: users.clerkId })
            .from(users)
            .where(eq(users.id, row.userId))
            .limit(1);

          if (freshUser?.clerkId) {
            // Already has a Clerk account — mark as activated, skip invitation
            await db
              .update(migrationRecords)
              .set({ invitedAt: new Date(), activatedAt: new Date() })
              .where(eq(migrationRecords.id, row.migrationId));
            skippedAlreadyActive++;
            return;
          }

          // Create Clerk invitation
          try {
            await client.invitations.createInvitation({
              emailAddress: row.email,
              redirectUrl: `${origin}/dashboard?migrated=1`,
              publicMetadata: { migratedFromSkool: true },
            });
          } catch (clerkErr: unknown) {
            // If Clerk says the email already exists as a user, or there's already
            // a pending invitation (duplicate_record), treat as already-invited.
            const msg = (clerkErr as Error).message ?? "";
            const clerkCode = (clerkErr as any)?.errors?.[0]?.code ?? "";
            if (
              clerkCode === "duplicate_record" ||
              msg.includes("already") ||
              msg.includes("exists") ||
              msg.includes("taken") ||
              msg.includes("duplicate")
            ) {
              await db
                .update(migrationRecords)
                .set({ invitedAt: new Date() })
                .where(eq(migrationRecords.id, row.migrationId));
              skippedAlreadyActive++;
              return;
            }
            throw clerkErr;
          }

          // Send our branded welcome email
          const result = await sendEmail({
            to: row.email,
            subject: "We built something better — claim your spot",
            html: welcomeBackHtml({ firstName: row.firstName, origin }),
          });

          if (!result.ok) throw new Error(result.reason);

          await db
            .update(migrationRecords)
            .set({ invitedAt: new Date() })
            .where(eq(migrationRecords.id, row.migrationId));

          sent++;
        } catch (err) {
          console.error("Invite failed for", row.email, err);
          failures.push({ email: row.email, error: (err as Error).message });
        }
      })
    );

    // Small pause between buckets to stay well under Clerk's rate limit
    if (i + CONCURRENCY < batch.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // How many invitable members are still in the queue?
  const [{ remaining }] = await db
    .select({ remaining: sql<number>`count(*)::int` })
    .from(users)
    .innerJoin(migrationRecords, eq(migrationRecords.userId, users.id))
    .where(baseFilter);

  return NextResponse.json({ ok: true, sent, skippedAlreadyActive, failures, remaining });
}

function welcomeBackHtml({
  firstName,
  origin,
}: {
  firstName: string | null;
  origin: string;
}) {
  const name = firstName ?? "hooper";
  return `
  <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px; color: #0A0A0A;">
    <div style="text-align:center; margin-bottom: 32px;">
      <div style="display:inline-block; font-weight:900; letter-spacing:2px; font-size:22px;">INFINITY HOOP</div>
    </div>
    <h1 style="font-size: 32px; line-height: 1.15; margin: 0 0 16px;">Hey ${name}, your spot is waiting 💫</h1>
    <p style="font-size: 16px; line-height: 1.6; color:#333;">
      We moved the Infinity Hoop community off Skool to a brand-new, branded home —
      with daily workouts, real progress tracking, the 45-Day Challenge, and a community feed
      that actually feels alive.
    </p>
    <p style="font-size: 16px; line-height: 1.6; color:#333;">
      Click below to claim your spot. One-tap sign-in. You'll go straight to your new dashboard.
    </p>
    <div style="text-align:center; margin: 32px 0;">
      <a href="${origin}/sign-in?migrated=1"
         style="display:inline-block; background: #d10352; color:white; padding:14px 28px; border-radius:999px; font-weight:700; text-decoration:none;">
        Claim my spot
      </a>
    </div>
    <div style="background:#FFF8E1; border-left:3px solid #d10352; border-radius:6px; padding:12px 16px; margin: 0 0 24px; font-size:14px; color:#555; line-height:1.5;">
      <strong style="color:#0A0A0A;">👀 Quick heads-up:</strong> After you click above, you'll get a
      6-digit verification code to confirm your email. It comes from our login provider
      (not this address), so <strong>check your spam folder</strong> if you don't see it
      within a minute. Just enter the code and you're in.
    </div>
    <p style="font-size: 14px; color:#666;">
      Skool closes soon. Don't lose your community — claim your spot today.
    </p>
  </div>`;
}
