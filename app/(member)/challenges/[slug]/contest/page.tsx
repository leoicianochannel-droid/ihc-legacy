import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import {
  db,
  users,
  challenges,
  challengeMembers,
  contestEnrollments,
  contestEntries,
} from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { EnrollForm, ContestDashboard } from "./contest-hub";

export default async function ContestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const [c] = await db.select().from(challenges).where(eq(challenges.slug, slug)).limit(1);
  if (!c) notFound();

  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) redirect("/sign-in");

  // Must have joined the challenge first
  const [membership] = await db
    .select()
    .from(challengeMembers)
    .where(and(eq(challengeMembers.challengeId, c.id), eq(challengeMembers.userId, me.id)))
    .limit(1);

  if (!membership) redirect(`/challenges/${slug}`);

  const [enrollment] = await db
    .select()
    .from(contestEnrollments)
    .where(and(eq(contestEnrollments.challengeId, c.id), eq(contestEnrollments.userId, me.id)))
    .limit(1);

  const entries = enrollment
    ? await db
        .select()
        .from(contestEntries)
        .where(eq(contestEntries.enrollmentId, enrollment.id))
    : [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href={`/challenges/${slug}`}>
          <ChevronLeft /> Back to challenge
        </Link>
      </Button>

      {!enrollment ? (
        <EnrollForm
          challengeId={c.id}
          challengeTitle={c.title}
          userFirstName={me.firstName ?? "there"}
        />
      ) : (
        <ContestDashboard
          enrollment={enrollment}
          entries={entries}
          challengeTitle={c.title}
          challengeEndsAt={c.endsAt}
          userFirstName={me.firstName ?? "there"}
        />
      )}
    </div>
  );
}
