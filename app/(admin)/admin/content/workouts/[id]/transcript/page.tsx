import { notFound, redirect } from "next/navigation";
import { db, workouts } from "@/lib/db";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TranscriptEditor } from "./transcript-editor";

export const dynamic = "force-dynamic";

export default async function WorkoutTranscriptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [w] = await db.select().from(workouts).where(eq(workouts.id, id)).limit(1);
  if (!w) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/admin/content"><ChevronLeft /> Back to content</Link>
      </Button>

      <h1 className="font-display text-2xl font-bold">{w.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Add or edit the transcript for this workout.</p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          <TranscriptEditor workoutId={w.id} initialTranscript={w.transcript ?? []} />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-4 text-sm text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground">Accepted formats</p>
          <p>Paste your transcript with timestamps on each line in any of these formats:</p>
          <pre className="rounded-xl bg-muted p-3 text-xs leading-relaxed">{`0:00 Welcome to today's workout!
1:30 Let's start with a warmup
3:45 Now we'll pick up the pace...

— or —

[00:00] Welcome to today's workout!
[01:30] Let's start with a warmup`}</pre>
          <p>Each line that starts with a timestamp becomes one segment. Lines without timestamps are joined to the previous segment.</p>
        </CardContent>
      </Card>
    </div>
  );
}
