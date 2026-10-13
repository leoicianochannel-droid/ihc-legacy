import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import {
  db,
  users,
  challenges,
  challengeMembers,
  challengeFeedback,
} from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Award, Download, ArrowRight } from "lucide-react";
import { CelebrationHero } from "./celebration-hero";
import { FeedbackForm } from "./feedback-form";
import { ShareWinCard } from "./share-win-card";

export const dynamic = "force-dynamic";

export default async function ChallengeCompletePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [me] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (!me) redirect("/onboarding");

  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.slug, slug))
    .limit(1);
  if (!challenge) notFound();

  const [mem] = await db
    .select()
    .from(challengeMembers)
    .where(
      and(
        eq(challengeMembers.challengeId, challenge.id),
        eq(challengeMembers.userId, me.id)
      )
    )
    .limit(1);

  // If they haven't joined or finished, send them back to the challenge page.
  if (!mem || !mem.completedAt) {
    redirect(`/challenges/${slug}`);
  }

  const [existingFeedback] = await db
    .select()
    .from(challengeFeedback)
    .where(eq(challengeFeedback.challengeMemberId, mem.id))
    .limit(1);

  const firstName = me.firstName ?? "Hooper";
  const fullName = `${me.firstName ?? ""} ${me.lastName ?? ""}`.trim() || "Hooper";

  return (
    <div className="relative mx-auto max-w-4xl px-6 py-10">
      <CelebrationHero firstName={firstName} />

      <div className="relative z-10 mt-8 space-y-8">
        {/* Headline */}
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            🎉 You finished
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">
            {firstName}, you did the {challenge.durationDays} days.
          </h1>
          <p className="mt-3 text-muted-foreground">
            That's not a small thing. Most people never start, then stop again.
            You showed up — and you have the receipts.
          </p>
        </div>

        {/* Share card */}
        <ShareWinCard
          challengeTitle={challenge.title}
          durationDays={challenge.durationDays}
        />

        {/* Certificate card */}
        <div className="rounded-3xl border bg-primary/8 p-8 text-center shadow-sm">
          <div className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Award className="size-7" />
          </div>
          <h2 className="mt-4 font-display text-2xl font-bold">
            Your certificate is ready
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Personalized for <span className="font-semibold text-foreground">{fullName}</span> ·
            completed {new Date(mem.completedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <Button asChild variant="gradient" size="lg" className="mt-5">
            <a href={`/api/certificate/${mem.id}`} download>
              <Download className="mr-2 size-4" /> Download certificate (PDF)
            </a>
          </Button>
        </div>

        {/* Feedback section */}
        <div className="rounded-3xl border bg-card p-6 md:p-8">
          {existingFeedback ? (
            <PostFeedbackThanks
              challenge={{ slug: challenge.slug, title: challenge.title }}
              positive={existingFeedback.rating >= 4 && existingFeedback.willReview}
            />
          ) : (
            <FeedbackForm challengeMemberId={mem.id} challengeTitle={challenge.title} />
          )}
        </div>

        {/* Back link */}
        <div className="flex justify-center">
          <Button asChild variant="ghost">
            <Link href="/dashboard">
              Back to today <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function PostFeedbackThanks({
  challenge,
  positive,
}: {
  challenge: { slug: string; title: string };
  positive: boolean;
}) {
  // Hard-coded for the flagship product. Update if Trustpilot URL changes.
  const trustpilotUrl = "https://www.trustpilot.com/review/infinityhoop.com";
  return (
    <div className="text-center">
      <h2 className="font-display text-2xl font-bold">Thank you 💜</h2>
      <p className="mt-2 text-muted-foreground">
        We read every word. This is how the platform gets better.
      </p>
      {positive && (
        <div className="mt-6 rounded-2xl bg-primary/5 p-5">
          <p className="text-sm font-semibold">
            You said you'd love to leave a public review — that means the world.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            One link. Two minutes. Helps another woman find this and finally feel good in her body.
          </p>
          <Button asChild variant="gradient" size="sm" className="mt-3">
            <a href={trustpilotUrl} target="_blank" rel="noopener noreferrer">
              Leave a Trustpilot review →
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
