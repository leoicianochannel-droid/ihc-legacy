"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db, users, streaks, referrals } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { generateReferralCode } from "@/lib/referrals";
import { syncSkioSubscriptionForUser } from "@/lib/sync-skio-subscription";
import {
  ADMIN_INVITE_COOKIE,
  consumeInvite,
  validateInvite,
} from "@/lib/admin-invites";
import { sendEmail, welcomeEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";
import { autoMatch } from "@/lib/buddy-matching";

// Promo config — first N signups (without an existing paid subscription) get
// K days of free access automatically.
const BETA_AUTO_SLOTS = 10;
const BETA_AUTO_DURATION_DAYS = 30;
const BETA_AUTO_NOTE_PREFIX = "auto-enrolled";

const schema = z.object({
  goal: z.string().min(2).max(500),
  fitnessLevel: z.enum(["beginner", "intermediate", "advanced"]),
  age: z.number().int().min(13).max(100),
  workoutPreferences: z.string().min(2).max(1000),
  movementTiming: z.string().max(500).optional(),
  idealBuddyWords: z.string().min(2).max(200),
  checkInStyle: z.enum(["fun", "soft", "accountability"]),
  otherMemberships: z.string().max(500).optional(),         // comma-separated
  otherMembershipsReason: z.string().max(1000).optional(),
  referralCode: z.string().max(40).optional(),
});

export async function saveOnboarding(raw: z.infer<typeof schema>) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Not authenticated");

  const data = schema.parse(raw);
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkId);
  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) throw new Error("No email on account");

  // Upsert user — look up by clerkId first, then by email as a fallback.
  // The email lookup is critical because:
  //   1. Skool-migrated users get a DB row at import time with no clerkId.
  //      First sign-up should LINK to that row, not duplicate it.
  //   2. Test users from the dev Clerk instance still exist by email after
  //      switching to production keys — same person, new clerkId.
  // The DB has a UNIQUE constraint on email, so trying to INSERT a duplicate
  // email throws a 23505 violation. Linking handles that cleanly.
  let existing = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (existing.length === 0) {
    const [byEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (byEmail) {
      // Link the existing row to the new clerkId rather than inserting.
      await db
        .update(users)
        .set({
          clerkId,
          firstName: clerkUser.firstName ?? byEmail.firstName,
          lastName: clerkUser.lastName ?? byEmail.lastName,
          avatarUrl: clerkUser.imageUrl ?? byEmail.avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, byEmail.id));
      existing = [{ ...byEmail, clerkId } as typeof byEmail];
    }
  }

  if (existing.length === 0) {
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const role: "admin" | "member" = adminEmails.includes(email.toLowerCase())
      ? "admin"
      : "member";

    const [u] = await db
      .insert(users)
      .values({
        clerkId,
        email,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        avatarUrl: clerkUser.imageUrl,
        role,
        goal: data.goal,
        fitnessLevel: data.fitnessLevel,
        age: data.age,
        workoutPreferences: data.workoutPreferences,
        movementTiming: data.movementTiming,
        idealBuddyWords: data.idealBuddyWords,
        checkInStyle: data.checkInStyle,
        otherMemberships: data.otherMemberships,
        otherMembershipsReason: data.otherMembershipsReason,
        referralCode: generateReferralCode(clerkUser.firstName),
        onboardedAt: new Date(),
      })
      .returning();

    await db.insert(streaks).values({ userId: u.id });

    // Auto-link any existing Skio subscription so existing payers don't need
    // to subscribe again on the new platform.
    const linkedSub = await syncSkioSubscriptionForUser(u.id, email);

    // Beta auto-enrollment — first N signups (who don't already have a paid
    // sub) get K days of free access automatically.
    if (!linkedSub) {
      const [{ used }] = await db
        .select({ used: sql<number>`count(*)::int` })
        .from(users)
        .where(sql`${users.betaNote} LIKE ${BETA_AUTO_NOTE_PREFIX + "%"}`);

      if (Number(used ?? 0) < BETA_AUTO_SLOTS) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + BETA_AUTO_DURATION_DAYS);
        const slotNumber = Number(used ?? 0) + 1;

        await db
          .update(users)
          .set({
            isBetaTester: true,
            freeAccessUntil: expiresAt,
            betaNote: `${BETA_AUTO_NOTE_PREFIX} (${slotNumber}/${BETA_AUTO_SLOTS})`,
          })
          .where(eq(users.id, u.id));
      }
    }

    // If they came in via a referral link, link them and record the referral
    if (data.referralCode) {
      const ref = data.referralCode.trim().toUpperCase();
      const [referrer] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.referralCode, ref))
        .limit(1);
      if (referrer && referrer.id !== u.id) {
        await db
          .update(users)
          .set({ referredByUserId: referrer.id })
          .where(eq(users.id, u.id));
        await db.insert(referrals).values({
          referrerUserId: referrer.id,
          referredUserId: u.id,
          referredEmail: email,
          status: "activated",
        });
      }
    }
  } else {
    await db
      .update(users)
      .set({
        goal: data.goal,
        fitnessLevel: data.fitnessLevel,
        age: data.age,
        workoutPreferences: data.workoutPreferences,
        movementTiming: data.movementTiming,
        idealBuddyWords: data.idealBuddyWords,
        checkInStyle: data.checkInStyle,
        otherMemberships: data.otherMemberships,
        otherMembershipsReason: data.otherMembershipsReason,
        onboardedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.clerkId, clerkId));

    // Re-check Skio in case they purchased after creating the account
    await syncSkioSubscriptionForUser(existing[0].id, email);
  }

  // Admin invite redemption — runs for BOTH new and existing rows. The
  // Clerk webhook may have created the user with role:"member" before
  // onboarding fires, so we always look at the cookie and consume it here.
  // ADMIN_EMAILS-based promotion is handled separately in the new-row branch.
  const jar = await cookies();
  const inviteToken = jar.get(ADMIN_INVITE_COOKIE)?.value;
  if (inviteToken) {
    const [u] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);
    if (u && u.role !== "admin") {
      const valid = await validateInvite(inviteToken);
      if (valid) {
        const consumed = await consumeInvite(inviteToken);
        if (consumed) {
          await db.update(users).set({ role: "admin" }).where(eq(users.id, u.id));
        }
      }
    }
    jar.delete(ADMIN_INVITE_COOKIE);
  }

  // Welcome email — only on first onboarding, not subsequent edits. Fire-and-
  // forget; a failed email never blocks the user from reaching the dashboard.
  if (existing.length === 0) {
    const { subject, html } = welcomeEmail({
      firstName: clerkUser.firstName ?? "friend",
      appUrl: getAppUrl(),
    });
    sendEmail({ to: email, subject, html }).catch((err) =>
      console.warn("welcome email failed", err)
    );
  }

  // Auto-match with an accountability buddy immediately after onboarding.
  // Fire-and-forget — a failed match never blocks the user.
  const [finalUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  if (finalUser) {
    autoMatch(finalUser.id).catch((err) =>
      console.warn("auto-match failed", err)
    );
  }

  revalidatePath("/dashboard");
}
