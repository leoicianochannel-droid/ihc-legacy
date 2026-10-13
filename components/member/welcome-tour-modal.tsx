"use client";

import { useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { iframeUrl } from "@/lib/cloudflare-stream";
import { markDemoVideoWatched, skipDemoVideo } from "@/app/(member)/welcome-tour-actions";

/**
 * Full-screen welcome tour video. Shown to a member once after they
 * acknowledge the welcome modal, the very first time they land on a
 * member page with a configured demo video.
 *
 * Two ways to dismiss:
 *   - "I'm done" → marks `demo_video_watched_at`
 *   - "Skip for now" → marks `demo_video_skipped_at` (still revisit-able from
 *     the Welcome / Help page)
 *
 * Either dismissal hides the modal for good on subsequent visits. The
 * "Watch tour" button on the Welcome / Help page lets them rewatch any time.
 */
export function WelcomeTourModal({
  videoUid,
  customerCode,
  durationSec,
  embedUrl,
  closable = true,
  onClose,
}: {
  videoUid: string;
  customerCode: string | null;
  durationSec: number | null;
  embedUrl?: string | null;
  closable?: boolean;
  onClose?: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const minutes = durationSec ? Math.ceil(durationSec / 60) : null;

  function close(action: "watched" | "skipped") {
    // If a local close callback is provided (e.g. rewatch context), call it
    // immediately so the modal dismisses without waiting for a server round-trip.
    if (onClose) {
      onClose();
      return;
    }
    startTransition(async () => {
      if (action === "watched") await markDemoVideoWatched();
      else await skipDemoVideo();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-tour-title"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b p-4 md:p-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              ✨ Welcome aboard
            </p>
            <h2 id="welcome-tour-title" className="mt-1 font-display text-xl font-bold md:text-2xl">
              A quick tour {minutes ? `(${minutes} min)` : ""}
            </h2>
            <p className="text-xs text-muted-foreground">
              Watch this once — it'll save you a week of figuring things out.
            </p>
          </div>
          {closable && (
            <button
              type="button"
              onClick={() => close("skipped")}
              aria-label="Skip for now"
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Video */}
        <div className="relative aspect-video w-full bg-black">
          <iframe
            src={
              embedUrl
                ? embedUrl
                : `${iframeUrl(videoUid, customerCode)}?autoplay=true&preload=auto`
            }
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 size-full"
          />
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t p-4 sm:flex-row sm:justify-between md:p-5">
          <p className="text-xs text-muted-foreground">
            You can rewatch any time from <strong>Welcome / Help</strong> in the menu.
          </p>
          <div className="flex gap-2">
            {closable && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => close("skipped")}
                disabled={isPending}
              >
                Skip for now
              </Button>
            )}
            <Button
              type="button"
              variant="gradient"
              size="sm"
              onClick={() => close("watched")}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : null}
              I'm done — let's go
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
