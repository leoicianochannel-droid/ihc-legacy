import { db, programs, programMembers } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { eq, asc } from "drizzle-orm";
import { db as d, users } from "@/lib/db";
import { ListChecks } from "lucide-react";
import { ProgramCard } from "@/components/member/program-card";

export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const { userId: clerkId } = await auth();
  const [me] = clerkId
    ? await d.select().from(users).where(eq(users.clerkId, clerkId)).limit(1)
    : [null];

  const active = await db
    .select()
    .from(programs)
    .where(eq(programs.isActive, true))
    .orderBy(asc(programs.sortOrder));

  const myPrograms = new Map(
    me
      ? (
          await db
            .select({ id: programMembers.programId, currentDay: programMembers.currentDay, completedAt: programMembers.completedAt })
            .from(programMembers)
            .where(eq(programMembers.userId, me.id))
        ).map((r) => [r.id, { currentDay: r.currentDay, completed: !!r.completedAt }])
      : [],
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-10 md:py-8">
      <h1 className="font-display text-4xl font-bold">Programs</h1>
      <p className="mt-1 text-muted-foreground">Guided plans you follow one day at a time.</p>

      {active.length === 0 ? (
        <div className="mt-6 rounded-2xl border bg-card py-12 text-center">
          <ListChecks className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">No programs yet</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {active.map((p) => (
            <ProgramCard key={p.id} program={p} progress={myPrograms.get(p.id) ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}
