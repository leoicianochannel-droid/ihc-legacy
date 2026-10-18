"use server";

import { auth } from "@clerk/nextjs/server";
import {
  db,
  users,
  challengeMembers,
  challengeCheckins,
  challenges,
  challengeFeedback,
} from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkInChallengeDay } from "@/lib/challenge-checkin";


const CURRENT_RUN_START = new Date("2026-07-01T00:00:00Z");

export async function joinChallenge(challengeId: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return;

  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return;

  const [existing] = await db
    .select()
    .from(challengeMembers)
    .where(and(eq(challengeMembers.challengeId, challengeId), eq(challengeMembers.userId, me.id)))
    .limit(1);

  if (existing) {
    // Already in the current run — nothing to do
    if (existing.startedAt >= CURRENT_RUN_START) {
      revalidatePath(`/challenges`);
      return;
    }
    // Membership from a prior run — reset to Day 1 and wipe old check-ins
    await db.delete(challengeCheckins).where(eq(challengeCheckins.challengeMemberId, existing.id));
    await db
      .update(challengeMembers)
      .set({ currentDay: 1, startedAt: new Date(), completedAt: null })
      .where(eq(challengeMembers.id, existing.id));
    revalidatePath(`/challenges`);
    return;
  }

  await db.insert(challengeMembers).values({
    challengeId,
    userId: me.id,
    currentDay: 1,
  });

  revalidatePath(`/challenges`);
}

export async function markChallengeDayComplete(memberId: string, dayNumber: number) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return;

  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return;

  const [mem] = await db
    .select()
    .from(challengeMembers)
    .where(eq(challengeMembers.id, memberId))
    .limit(1);
  if (!mem || mem.userId !== me.id) return;

  const result = await checkInChallengeDay(me, mem, dayNumber);
  if (!result.checkedIn) return;

  revalidatePath(`/challenges`);
  if (result.slug) revalidatePath(`/challenges/${result.slug}`);
  revalidatePath("/dashboard");

  // First time crossing the finish line → send them to the celebration page.
  if (result.finishedSlug) {
    redirect(`/challenges/${result.finishedSlug}/complete`);
  }
}

/**
 * Submit end-of-challenge feedback. Returns the willReview signal so the
 * client can route the user to a Trustpilot CTA when they rated us highly.
 */
export async function submitChallengeFeedback(input: {
  challengeMemberId: string;
  rating: number;
  wouldRecommend: boolean;
  favoritePart?: string;
  improvement?: string;
  willReview: boolean;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { ok: false as const, error: "not_authenticated" };

  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return { ok: false as const, error: "no_user" };

  const [mem] = await db
    .select()
    .from(challengeMembers)
    .where(eq(challengeMembers.id, input.challengeMemberId))
    .limit(1);
  if (!mem || mem.userId !== me.id) {
    return { ok: false as const, error: "forbidden" };
  }

  const rating = Math.max(1, Math.min(5, Math.round(input.rating)));

  // Idempotent — if they already submitted, update instead of throwing.
  const [existing] = await db
    .select({ id: challengeFeedback.id })
    .from(challengeFeedback)
    .where(eq(challengeFeedback.challengeMemberId, input.challengeMemberId))
    .limit(1);

  if (existing) {
    await db
      .update(challengeFeedback)
      .set({
        rating,
        wouldRecommend: input.wouldRecommend,
        favoritePart: input.favoritePart?.slice(0, 2000) ?? null,
        improvement: input.improvement?.slice(0, 2000) ?? null,
        willReview: input.willReview,
      })
      .where(eq(challengeFeedback.id, existing.id));
  } else {
    await db.insert(challengeFeedback).values({
      challengeMemberId: input.challengeMemberId,
      rating,
      wouldRecommend: input.wouldRecommend,
      favoritePart: input.favoritePart?.slice(0, 2000) ?? null,
      improvement: input.improvement?.slice(0, 2000) ?? null,
      willReview: input.willReview,
    });
  }

  return { ok: true as const, rating, wouldRecommend: input.wouldRecommend };
}
