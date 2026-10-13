"use client";

import { useState, useTransition } from "react";
import { Download, Users, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { createPost } from "@/app/(member)/community/actions";

export function ShareWinCard({
  challengeTitle,
  durationDays,
}: {
  challengeTitle: string;
  durationDays: number;
}) {
  const [posted, setPosted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const cardUrl = `/api/challenge-card?day=${durationDays}&total=${durationDays}`;

  const postBody =
    `I just completed the ${challengeTitle}! 🎉🏆\n\n` +
    `Day ${durationDays} done. So proud of myself for showing up. ` +
    `Couldn't have done it without this community. 💪\n\n#InfinityHoop`;

  function shareToFeed() {
    startTransition(async () => {
      await createPost({ body: postBody, category: "wins" });
      setPosted(true);
    });
  }

  async function downloadCard() {
    try {
      const res = await fetch(cardUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `infinity-hoop-challenge-complete.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab so they can save manually
      window.open(cardUrl, "_blank", "noopener");
    }
  }

  return (
    <div className="rounded-3xl border bg-card p-6 text-center shadow-sm">
      <h2 className="font-display text-2xl font-bold">Share your win</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Save your completion card or let the community celebrate with you.
      </p>

      {/* Card preview */}
      <div className="mx-auto mt-4 max-w-xs overflow-hidden rounded-2xl border shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cardUrl}
          alt={`${challengeTitle} completion card`}
          className="w-full"
          width={540}
          height={540}
        />
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={downloadCard}
        >
          <Download className="mr-2 size-4" />
          Save to photos
        </Button>

        {posted ? (
          <Button variant="gradient" className="flex-1" disabled>
            <Check className="mr-2 size-4" /> Posted!
          </Button>
        ) : (
          <Button
            type="button"
            variant="gradient"
            className="flex-1"
            disabled={isPending}
            onClick={shareToFeed}
          >
            {isPending ? (
              <><Loader2 className="mr-2 size-4 animate-spin" /> Posting…</>
            ) : (
              <><Users className="mr-2 size-4" /> Post to community</>
            )}
          </Button>
        )}
      </div>

      {posted && (
        <button
          type="button"
          onClick={() => router.push("/community")}
          className="mt-3 text-xs font-semibold text-primary hover:underline"
        >
          See your post in the community →
        </button>
      )}
    </div>
  );
}
