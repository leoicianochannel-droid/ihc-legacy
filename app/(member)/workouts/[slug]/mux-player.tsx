"use client";

import { useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markWorkoutComplete } from "./actions";
import MuxPlayer from "@mux/mux-player-react";

export function MuxWorkoutPlayer({
  playbackId,
  workoutId,
  title,
}: {
  playbackId: string;
  workoutId: string;
  title: string;
}) {
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

  function handleTimeUpdate(e: Event) {
    if (reportedRef.current) return;
    const el = e.target as HTMLVideoElement;
    if (el.duration > 0 && el.currentTime / el.duration > 0.8) {
      reportComplete();
    }
  }

  return (
    <div>
      <MuxPlayer
        playbackId={playbackId}
        metadata={{ video_title: title }}
        style={{ width: "100%", aspectRatio: "16/9", borderRadius: 16 }}
        accentColor="#E91E8F"
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => reportComplete()}
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
    </div>
  );
}
