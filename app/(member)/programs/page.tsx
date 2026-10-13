import Link from "next/link";
import { db, programs, programMembers } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { eq, asc } from "drizzle-orm";
import { db as d, users } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListChecks, ArrowRight } from "lucide-react";

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

  const myProgressIds = me
    ? (
        await db
          .select({ id: programMembers.programId })
          .from(programMembers)
          .where(eq(programMembers.userId, me.id))
      ).map((r) => r.id)
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-10 md:py-8">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold">Programs</h1>
        <p className="mt-1 text-muted-foreground">
          Step-by-step guided plans. Day by day, week by week.
        </p>
      </div>

      {active.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ListChecks className="mx-auto size-12 text-muted-foreground" />
            <p className="mt-4 font-display text-xl font-bold">No programs yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {active.map((p) => {
            const joined = myProgressIds.includes(p.id);
            return (
              <Card key={p.id} className="overflow-hidden">
                <div className="hoop-gradient-bold relative aspect-[16/9] p-6">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                    <Badge variant="gold">{p.durationDays}-day program</Badge>
                    <h2 className="mt-2 font-display text-3xl font-bold">{p.title}</h2>
                    {p.subtitle && <p className="text-sm opacity-90">{p.subtitle}</p>}
                  </div>
                </div>
                <CardContent className="p-6">
                  <p className="text-sm text-foreground/80">{p.description}</p>
                  <Button asChild variant={joined ? "outline" : "gradient"} className="mt-4 w-full">
                    <Link href={`/programs/${p.slug}`}>
                      {joined ? "Continue program" : "Start program"} <ArrowRight />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
