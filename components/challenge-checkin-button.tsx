"use client";

import { useTransition, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { markChallengeDayComplete } from "@/app/(member)/challenges/[slug]/actions";
import { uploadPostAttachments, createPost } from "@/app/(member)/community/actions";
import { Download, Share2, X, Camera, Check, Loader2 } from "lucide-react";

interface Props {
  memberId: string;
  dayNumber: number;
  totalDays: number;
}

export function ChallengeCheckinButton({ memberId, dayNumber, totalDays }: Props) {
  const [isPending, startTransition] = useTransition();
  const [completedDay, setCompletedDay] = useState<number | null>(null);

  function handleCheckin() {
    startTransition(async () => {
      await markChallengeDayComplete(memberId, dayNumber);
      // Only reached when not the final day (final day triggers a redirect).
      setCompletedDay(dayNumber);
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        disabled={isPending}
        onClick={handleCheckin}
      >
        {isPending ? "Saving…" : "Mark day complete"}
      </Button>

      {completedDay !== null && (
        <ShareSheet
          day={completedDay}
          total={totalDays}
          onClose={() => setCompletedDay(null)}
        />
      )}
    </>
  );
}

function ShareSheet({
  day,
  total,
  onClose,
}: {
  day: number;
  total: number;
  onClose: () => void;
}) {
  const cardUrl = `/api/challenge-card?day=${day}&total=${total}`;
  const autoCaption = `Just completed Day ${day} of the 30-day challenge! 💪 #communitychallenge26`;

  // Photo post state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [postStatus, setPostStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleShare() {
    try {
      const res = await fetch(cardUrl);
      const blob = await res.blob();
      const file = new File([blob], `day-${day}-complete.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Day ${day} of ${total} complete! 🎉`,
          text: `Just crushed Day ${day} of the 30-Day Challenge! #InfinityHoop`,
        });
        return;
      }
    } catch {
      // fall through to download
    }
    triggerDownload(cardUrl, day);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPostStatus("idle");
  }

  async function handlePostToCommunity() {
    if (!photoFile) return;
    setPostStatus("uploading");
    try {
      const fd = new FormData();
      fd.append("files", photoFile);
      const result = await uploadPostAttachments(fd);
      if (!result.ok || !result.attachments?.length) throw new Error("upload failed");
      await createPost({ body: autoCaption, category: "wins", attachments: result.attachments });
      setPostStatus("done");
    } catch {
      setPostStatus("error");
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-[#130820] border-t border-white/10 pb-safe-area-inset-bottom animate-in slide-in-from-bottom duration-300 max-h-[90dvh] overflow-y-auto">
        {/* Handle */}
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-white/20" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>

        <div className="flex flex-col items-center px-6 pb-8 pt-4">
          <p className="text-2xl font-bold text-white mb-1">Day {day} complete! 🎉</p>
          <p className="text-sm text-white/50 mb-5">Share your progress with the community</p>

          {/* Card preview */}
          <div className="w-full max-w-xs aspect-square rounded-2xl overflow-hidden shadow-2xl mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cardUrl}
              alt={`Day ${day} of ${total} complete`}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Card share buttons */}
          <div className="flex gap-3 w-full max-w-xs mb-6">
            <Button
              onClick={handleShare}
              className="flex-1 bg-gradient-to-r from-[#d10352] to-[#9d0099] hover:opacity-90 text-white border-0"
            >
              <Share2 className="size-4 mr-2" />
              Share card
            </Button>
            <Button
              variant="outline"
              onClick={() => triggerDownload(cardUrl, day)}
              className="flex-1 border-white/20 text-white hover:bg-white/10"
            >
              <Download className="size-4 mr-2" />
              Save
            </Button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 w-full max-w-xs mb-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/30 shrink-0">or post a photo</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Photo upload area */}
          {postStatus === "done" ? (
            <div className="w-full max-w-xs flex flex-col items-center gap-2 py-4">
              <div className="flex size-12 items-center justify-center rounded-full bg-green-500/20">
                <Check className="size-6 text-green-400" />
              </div>
              <p className="text-sm font-semibold text-white">Posted to community!</p>
              <p className="text-xs text-white/40">Your photo is live in the wins feed</p>
            </div>
          ) : (
            <div className="w-full max-w-xs">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />

              {photoPreview ? (
                /* Photo selected — show preview + post button */
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-full aspect-square rounded-xl overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreview} alt="Your photo" className="w-full h-full object-cover" />
                    <button
                      onClick={() => { setPhotoFile(null); setPhotoPreview(null); setPostStatus("idle"); }}
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white/70 hover:text-white"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <p className="text-xs text-white/40 text-center px-2">{autoCaption}</p>
                  {postStatus === "error" && (
                    <p className="text-xs text-red-400">Something went wrong — try again</p>
                  )}
                  <Button
                    onClick={handlePostToCommunity}
                    disabled={postStatus === "uploading"}
                    className="w-full bg-gradient-to-r from-[#d10352] to-[#9d0099] hover:opacity-90 text-white border-0"
                  >
                    {postStatus === "uploading" ? (
                      <><Loader2 className="size-4 mr-2 animate-spin" /> Posting…</>
                    ) : (
                      "Post to Community"
                    )}
                  </Button>
                </div>
              ) : (
                /* No photo yet — show picker */
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/20 py-5 text-white/50 hover:border-white/40 hover:text-white/70 transition-colors"
                >
                  <Camera className="size-7" />
                  <span className="text-sm">Tap to add a photo</span>
                  <span className="text-xs text-white/30">Posts to the community wins feed</span>
                </button>
              )}
            </div>
          )}

          <button
            onClick={onClose}
            className="mt-5 text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </>
  );
}

function triggerDownload(url: string, day: number) {
  const a = document.createElement("a");
  a.href = url;
  a.download = `day-${day}-complete.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
