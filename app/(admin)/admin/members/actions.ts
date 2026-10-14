"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, memberPlans, streaks } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { sendEmail, memberInviteEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";

async function assertAdmin() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("not_authenticated");
  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (me?.role !== "admin") throw new Error("forbidden");
  return me;
}

/** Promote a member to admin or demote back to member. */
export async function setMemberRole(userId: string, role: "admin" | "member") {
  const me = await assertAdmin();
  // Don't allow an admin to demote themselves — would lock them out.
  if (userId === me.id && role !== "admin") {
    throw new Error("Can't demote yourself");
  }
  await db.update(users).set({ role }).where(eq(users.id, userId));
  revalidatePath("/admin/members");
}

/** Reset a member's progress back to Day 1. */
export async function resetMemberPlan(userId: string) {
  await assertAdmin();
  // Clear the plan row — they'll be sent back through plan-setup to generate a fresh plan
  await db.delete(memberPlans).where(eq(memberPlans.userId, userId));
  // Reset onboarding clock, plan gate, and milestone celebrations
  await db
    .update(users)
    .set({
      onboardedAt: sql`now()`,
      planCompletedAt: null,
      celebratedMilestones: sql`'{}'::integer[]`,
    })
    .where(eq(users.id, userId));
  revalidatePath("/admin/members");
  revalidatePath("/workouts");
}

/**
 * Toggle beta-tester status, granting 30 days of free access from now.
 * Idempotent — re-toggling resets the 30-day window.
 */
export async function toggleBetaTester(userId: string, makeBeta: boolean) {
  await assertAdmin();
  if (makeBeta) {
    await db
      .update(users)
      .set({
        isBetaTester: true,
        freeAccessUntil: sql`now() + interval '30 days'`,
      })
      .where(eq(users.id, userId));
  } else {
    await db
      .update(users)
      .set({ isBetaTester: false, freeAccessUntil: null })
      .where(eq(users.id, userId));
  }
  revalidatePath("/admin/members");
}

export type AddMemberInput = {
  email: string;
  firstName?: string;
  lastName?: string;
  /** "none" = normal paid member, "until" = free until `freeUntil`, "forever" = comped */
  access: "none" | "until" | "forever";
  freeUntil?: string;            // YYYY-MM-DD, required when access = "until"
  note?: string;
  sendInvite: boolean;
};

export type AddMemberResult =
  | { ok: true; msg: string }
  | { ok: false; msg: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Add a member by email before they've signed up. Creates their users row
 * (optionally with free access) and can email them a sign-up link. When they
 * create an account with the same email, the Clerk webhook / onboarding links
 * the new login to this row, so the access carries over.
 */
export async function addMember(input: AddMemberInput): Promise<AddMemberResult> {
  const me = await assertAdmin();

  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, msg: "Enter a valid email address." };

  const [existing] = await db
    .select({ id: users.id, clerkId: users.clerkId })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  if (existing) {
    return {
      ok: false,
      msg: existing.clerkId
        ? `${email} already has an account. Search for them below to manage their access.`
        : `${email} is already on the list (added earlier or from a Skio purchase) but hasn't signed up yet. Use Beta / free access to give them free access.`,
    };
  }

  let freeAccessUntil: Date | null = null;
  if (input.access === "forever") {
    freeAccessUntil = new Date("2099-01-01T00:00:00Z");
  } else if (input.access === "until") {
    const d = input.freeUntil ? new Date(`${input.freeUntil}T23:59:59Z`) : null;
    if (!d || Number.isNaN(d.getTime())) return { ok: false, msg: "Pick a valid free-access end date." };
    if (d.getTime() < Date.now()) return { ok: false, msg: "The free-access end date is in the past." };
    freeAccessUntil = d;
  }

  const firstName = input.firstName?.trim() || null;
  const lastName = input.lastName?.trim() || null;
  const adminName = [me.firstName, me.lastName].filter(Boolean).join(" ") || me.email;
  const note = [`Added by ${adminName}`, input.note?.trim()].filter(Boolean).join(": ");

  const [created] = await db
    .insert(users)
    .values({
      email,
      firstName,
      lastName,
      role: "member",
      isBetaTester: freeAccessUntil != null,
      freeAccessUntil,
      betaNote: note,
    })
    .onConflictDoNothing()
    .returning({ id: users.id });
  if (!created) return { ok: false, msg: `${email} was just added by someone else.` };
  await db.insert(streaks).values({ userId: created.id }).onConflictDoNothing();

  revalidatePath("/admin/members");
  revalidatePath("/admin/beta");

  const who = firstName ?? email;
  if (!input.sendInvite) {
    return { ok: true, msg: `✓ Added ${who}. No email sent. They can sign up with ${email}.` };
  }
  const { subject, html } = memberInviteEmail({
    firstName,
    email,
    appUrl: getAppUrl(),
    freeAccessUntil,
  });
  const sent = await sendEmail({ to: email, subject, html });
  return sent.ok
    ? { ok: true, msg: `✓ Added ${who} and emailed them a sign-up link.` }
    : {
        ok: true,
        msg: `✓ Added ${who}, but the invite email didn't send (${sent.reason === "no_key" ? "email isn't configured" : sent.error ?? "send failed"}). Ask them to sign up with ${email}.`,
      };
}
