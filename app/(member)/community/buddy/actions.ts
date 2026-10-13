"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, buddyMatches } from "@/lib/db";
import { and, eq, or } from "drizzle-orm";
import { proposeMatch, runBulkMatch } from "@/lib/buddy-matching";
import { revalidatePath } from "next/cache";

export async function proposeBuddy(candidateUserId: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return;
  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return;

  await proposeMatch(me.id, candidateUserId);
  revalidatePath("/community/buddy");
}

export async function acceptBuddy(matchId: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return;

  await db
    .update(buddyMatches)
    .set({ status: "active", pairedAt: new Date() })
    .where(eq(buddyMatches.id, matchId));

  revalidatePath("/community/buddy");
}

/** End the caller's active match and re-run bulk match to free their partner. */
export async function leaveMatch(): Promise<void> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return;
  const [me] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return;

  await db
    .update(buddyMatches)
    .set({ status: "ended" })
    .where(
      and(
        or(eq(buddyMatches.userAId, me.id), eq(buddyMatches.userBId, me.id)),
        eq(buddyMatches.status, "active")
      )
    );

  // Rematch the abandoned partner automatically
  await runBulkMatch();

  revalidatePath("/community/buddy");
}

/** Leave current match and immediately attempt to find a new one. */
export async function leaveAndRematch(): Promise<{ paired: boolean }> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { paired: false };
  const [me] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return { paired: false };

  await db
    .update(buddyMatches)
    .set({ status: "ended" })
    .where(
      and(
        or(eq(buddyMatches.userAId, me.id), eq(buddyMatches.userBId, me.id)),
        eq(buddyMatches.status, "active")
      )
    );

  await runBulkMatch();
  revalidatePath("/community/buddy");

  const [match] = await db
    .select({ id: buddyMatches.id })
    .from(buddyMatches)
    .where(
      and(
        or(eq(buddyMatches.userAId, me.id), eq(buddyMatches.userBId, me.id)),
        eq(buddyMatches.status, "active")
      )
    )
    .limit(1);

  return { paired: !!match };
}

/** Member-triggered re-match. Runs the full bulk match and refreshes the page. */
export async function requestRematch(): Promise<{ paired: boolean }> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { paired: false };

  await runBulkMatch();
  revalidatePath("/community/buddy");

  const [me] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  if (!me) return { paired: false };

  const [match] = await db
    .select({ id: buddyMatches.id })
    .from(buddyMatches)
    .where(
      and(
        or(eq(buddyMatches.userAId, me.id), eq(buddyMatches.userBId, me.id)),
        eq(buddyMatches.status, "active")
      )
    )
    .limit(1);

  return { paired: !!match };
}
