import "server-only";
import { db, programMembers, programDayCompletions, programs } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { logActivity } from "@/lib/streak";

type ProgramMember = typeof programMembers.$inferSelect;

/**
 * Mark one program day complete. Shared by the "Mark day complete" button
 * and by finishing the last video in a day. Returns whether this finished
 * the whole program.
 */
export async function completeProgramDay(
  me: { id: string; timezone: string | null },
  mem: ProgramMember,
  dayNumber: number,
): Promise<{ completed: boolean; finishedProgram: boolean }> {
  const inserted = await db
    .insert(programDayCompletions)
    .values({ programMemberId: mem.id, dayNumber })
    .onConflictDoNothing()
    .returning({ id: programDayCompletions.id });
  if (inserted.length === 0) return { completed: false, finishedProgram: false };

  const [program] = await db.select().from(programs).where(eq(programs.id, mem.programId)).limit(1);
  const total = program?.durationDays ?? dayNumber;

  const [{ done }] = await db
    .select({ done: sql<number>`count(*)::int` })
    .from(programDayCompletions)
    .where(eq(programDayCompletions.programMemberId, mem.id));

  // Unlock the day after the one just finished (never move backwards).
  const nextDay = Math.min(Math.max(mem.currentDay, dayNumber + 1), total);
  const finishedProgram = Number(done) >= total && !mem.completedAt;

  await db
    .update(programMembers)
    .set({ currentDay: nextDay, completedAt: finishedProgram ? new Date() : mem.completedAt })
    .where(and(eq(programMembers.id, mem.id)));

  await logActivity({
    userId: me.id,
    type: "challenge_day_completed",
    referenceId: mem.programId,
    meta: { dayNumber, kind: "program" },
    timezone: me.timezone ?? undefined,
  });

  return { completed: true, finishedProgram };
}
