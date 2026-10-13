"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markWorkoutComplete } from "./actions";

/**
 * Cloudflare Stream-powered player.
 *
 * Cloudflare Stream's iframe does NOT post arbitrary `{currentTime, duration}`
 * messages to window — to receive playback events you must wrap the iframe with
 * the Stream SDK (`window.Stream(iframe)`). We load the SDK, then listen for
 * `timeupdate` and `ended` to auto-mark the workout complete at 80% watched
 * (or end-of-video, whichever comes first).
 *
 * As a backstop in case the SDK fails to load (slow networks, blockers), there
 * is an always-visible "I finished this" button. So tracking can never silently
 * fail again.
 */

declare global {
  interface Window {
    Stream?: (iframe: HTMLIFrameElement) => StreamPlayer;
  }
}

interface StreamPlayer {
  currentTime: number;
  duration: number;
  addEventListener: (event: string, cb: () => void) => void;
  removeEventListener: (event: string, cb: () => void) => void;
}

const SDK_SRC = "https://embed.videodelivery.net/embed/sdk.latest.js";

function loadStreamSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Stream) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[src="${SDK_SRC}"]`
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("sdk_load_failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = SDK_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("sdk_load_failed"));
    document.head.appendChild(s);
  });
}

export function WorkoutPlayer({
  cfStreamUid,
  cfCustomerCode,
  workoutId,
  title,
  postCompletion,
}: {
  cfStreamUid: string;
  cfCustomerCode: string | null;
  workoutId: string;
  title: string;
  postCompletion?: React.ReactNode;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const reportedRef = useRef(false);
  const [completed, setCompleted] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reportComplete() {
    if (reportedRef.current) return;
    reportedRef.current = true;
    setMarking(true);
    setError(null);
    try {
      const res = await markWorkoutComplete(workoutId);
      if (res && "ok" in res && res.ok) {
        setCompleted(true);
      } else {
        // Roll back so they can retry
        reportedRef.current = false;
        setError("Couldn't save. Tap to retry.");
      }
    } catch {
      reportedRef.current = false;
      setError("Couldn't save. Tap to retry.");
    } finally {
      setMarking(false);
    }
  }

  // Reset state if workoutId changes (rare — but keeps things sane)
  useEffect(() => {
    reportedRef.current = false;
    setCompleted(false);
    setError(null);
  }, [workoutId]);

  // Wire up Cloudflare Stream SDK to auto-detect 80% / ended
  useEffect(() => {
    let player: StreamPlayer | null = null;
    let cancelled = false;

    const onTime = () => {
      if (!player || reportedRef.current) return;
      const { currentTime, duration } = player;
      if (
        typeof currentTime === "number" &&
        typeof duration === "number" &&
        duration > 0 &&
        currentTime / duration > 0.8
      ) {
        reportComplete();
      }
    };
    const onEnded = () => reportComplete();

    loadStreamSdk()
      .then(() => {
        if (cancelled || !iframeRef.current || !window.Stream) return;
        player = window.Stream(iframeRef.current);
        player.addEventListener("timeupdate", onTime);
        player.addEventListener("ended", onEnded);
      })
      .catch(() => {
        // SDK unreachable — manual button still works.
      });

    return () => {
      cancelled = true;
      if (player) {
        try {
          player.removeEventListener("timeupdate", onTime);
          player.removeEventListener("ended", onEnded);
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId]);

  const baseSrc = cfCustomerCode
    ? `https://customer-${cfCustomerCode}.cloudflarestream.com/${cfStreamUid}/iframe`
    : `https://iframe.videodelivery.net/${cfStreamUid}`;

  const src = `${baseSrc}?poster=https%3A%2F%2Fcustomer-${cfCustomerCode ?? "x"}.cloudflarestream.com%2F${cfStreamUid}%2Fthumbnails%2Fthumbnail.jpg%3Ftime%3D5s&primaryColor=%23E91E8F`;

  return (
    <div>
      <iframe
        ref={iframeRef}
        title={title}
        src={src}
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; airplay; remote-playback;"
        allowFullScreen
        style={{ width: "100%", aspectRatio: "16/9", border: 0, borderRadius: 16 }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {completed ? (
          <Button variant="outline" size="sm" disabled>
            <Check className="mr-1 size-4" /> Done — logged for today
          </Button>
        ) : (
          <Button
            variant="gradient"
            size="sm"
            onClick={reportComplete}
            disabled={marking}
          >
            {marking ? (
              <>
                <Loader2 className="mr-1 size-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Check className="mr-1 size-4" /> I finished this workout
              </>
            )}
          </Button>
        )}
        {!completed && (
          <span className="text-xs text-muted-foreground">
            Auto-logs at 80% watched, or tap when you finish.
          </span>
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
      {completed && postCompletion && postCompletion}
    </div>
  );
}
