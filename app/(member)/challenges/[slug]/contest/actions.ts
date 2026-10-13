"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, challenges, challengeMembers, contestEnrollments, contestEntries } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function getMe() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;
  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return me ?? null;
}

export async function enrollInContest(
  challengeId: string,
  data: {
    instagramHandle?: string;
    tiktokHandle?: string;
    startWaistInches?: number;
  }
) {
  const me = await getMe();
  if (!me) return { error: "not_authenticated" };

  const [membership] = await db
    .select()
    .from(challengeMembers)
    .where(and(eq(challengeMembers.challengeId, challengeId), eq(challengeMembers.userId, me.id)))
    .limit(1);
  if (!membership) return { error: "not_a_challenge_member" };

  await db
    .insert(contestEnrollments)
    .values({
      challengeId,
      userId: me.id,
      instagramHandle: data.instagramHandle || null,
      tiktokHandle: data.tiktokHandle || null,
      startWaistInches: data.startWaistInches ?? null,
    })
    .onConflictDoNothing();

  revalidatePath(`/challenges`);
  return { success: true };
}

export async function addContestEntry(
  enrollmentId: string,
  data: {
    entryType: "reel" | "nsv" | "measurement" | "transformation";
    reelUrl?: string;
    reelPlatform?: string;
    reelViewCount?: number;
    title?: string;
    story?: string;
    photoUrls?: string[];
    waistInches?: number;
  }
) {
  const me = await getMe();
  if (!me) return { error: "not_authenticated" };

  // verify the enrollment belongs to this user
  const [enrollment] = await db
    .select()
    .from(contestEnrollments)
    .where(and(eq(contestEnrollments.id, enrollmentId), eq(contestEnrollments.userId, me.id)))
    .limit(1);
  if (!enrollment) return { error: "not_your_enrollment" };

  await db.insert(contestEntries).values({
    enrollmentId,
    entryType: data.entryType,
    reelUrl: data.reelUrl || null,
    reelPlatform: data.reelPlatform || null,
    reelViewCount: data.reelViewCount ?? null,
    title: data.title || null,
    story: data.story || null,
    photoUrls: data.photoUrls?.length ? data.photoUrls : null,
    waistInches: data.waistInches ?? null,
  });

  revalidatePath(`/challenges`);
  return { success: true };
}

export async function updateContestEntry(
  entryId: string,
  data: {
    reelUrl?: string;
    reelPlatform?: string;
    reelViewCount?: number;
    title?: string;
    story?: string;
    photoUrls?: string[];
    waistInches?: number;
  }
) {
  const me = await getMe();
  if (!me) return { error: "not_authenticated" };

  // verify ownership via enrollment join
  const [entry] = await db
    .select({ id: contestEntries.id, enrollmentId: contestEntries.enrollmentId })
    .from(contestEntries)
    .where(eq(contestEntries.id, entryId))
    .limit(1);
  if (!entry) return { error: "not_found" };

  const [enrollment] = await db
    .select()
    .from(contestEnrollments)
    .where(and(eq(contestEnrollments.id, entry.enrollmentId), eq(contestEnrollments.userId, me.id)))
    .limit(1);
  if (!enrollment) return { error: "not_your_entry" };

  await db
    .update(contestEntries)
    .set({
      reelUrl: data.reelUrl || null,
      reelPlatform: data.reelPlatform || null,
      reelViewCount: data.reelViewCount ?? null,
      title: data.title || null,
      story: data.story || null,
      photoUrls: data.photoUrls?.length ? data.photoUrls : null,
      waistInches: data.waistInches ?? null,
      updatedAt: new Date(),
    })
    .where(eq(contestEntries.id, entryId));

  revalidatePath(`/challenges`);
  return { success: true };
}

export async function deleteContestEntry(entryId: string) {
  const me = await getMe();
  if (!me) return { error: "not_authenticated" };

  const [entry] = await db
    .select({ id: contestEntries.id, enrollmentId: contestEntries.enrollmentId })
    .from(contestEntries)
    .where(eq(contestEntries.id, entryId))
    .limit(1);
  if (!entry) return { error: "not_found" };

  const [enrollment] = await db
    .select()
    .from(contestEnrollments)
    .where(and(eq(contestEnrollments.id, entry.enrollmentId), eq(contestEnrollments.userId, me.id)))
    .limit(1);
  if (!enrollment) return { error: "not_your_entry" };

  await db.delete(contestEntries).where(eq(contestEntries.id, entryId));
  revalidatePath(`/challenges`);
  return { success: true };
}
