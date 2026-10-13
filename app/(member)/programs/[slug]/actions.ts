"use server";

import { auth } from "@clerk/nextjs/server";
import {
  db,
  users,
  programMembers,
  programDayCompletions,
  programs,
} from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/streak";

export async function joinProgram(programId: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return;
  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return;

  const [existing] = await db
    .select()
    .from(programMembers)
    .where(and(eq(programMembers.programId, programId), eq(programMembers.userId, me.id)))
    .limit(1);
  if (existing) {
    revalidatePath(`/programs`);
    return;
  }

  await db.insert(programMembers).values({ programId, userId: me.id, currentDay: 1 });
  revalidatePath(`/programs`);
}

export async function markProgramDayComplete(memberId: string, dayNumber: number) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return;
  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return;

  const [mem] = await db
    .select()
    .from(programMembers)
    .where(eq(programMembers.id, memberId))
    .limit(1);
  if (!mem || mem.userId !== me.id) return;

  // Don't double-log
  const [dupe] = await db
    .select()
    .from(programDayCompletions)
    .where(
      and(
        eq(programDayCompletions.programMemberId, memberId),
        eq(programDayCompletions.dayNumber, dayNumber)
      )
    )
    .limit(1);
  if (dupe) return;

  await db
    .insert(programDayCompletions)
    .values({ programMemberId: memberId, dayNumber });

  // Advance currentDay if completing today's day
  const [program] = await db
    .select()
    .from(programs)
    .where(eq(programs.id, mem.programId))
    .limit(1);

  const nextDay = Math.min(mem.currentDay + 1, program?.durationDays ?? mem.currentDay + 1);
  await db
    .update(programMembers)
    .set({
      currentDay: nextDay,
      completedAt:
        nextDay > (program?.durationDays ?? Infinity) ? new Date() : null,
    })
    .where(eq(programMembers.id, memberId));

  await logActivity({
    userId: me.id,
    type: "challenge_day_completed",
    referenceId: mem.programId,
    meta: { dayNumber, kind: "program" },
    timezone: me.timezone ?? undefined,
  });

  revalidatePath(`/programs`);
  revalidatePath("/dashboard");
}
