"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, programMembers } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { completeProgramDay } from "@/lib/program-progress";

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

  await completeProgramDay(me, mem, dayNumber);

  revalidatePath(`/programs`, "layout");
  revalidatePath("/dashboard");
}
