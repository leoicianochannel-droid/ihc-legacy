"use client";

import type { WorkoutContext } from "@/lib/workout-context";
import MuxPlayer from "@mux/mux-player-react";
import { CompletionBar, useWorkoutCompletion } from "./completion";

export function MuxWorkoutPlayer({
  playbackId,
  workoutId,
  title,
  ctx = null,
  backLabel = null,
}: {
  playbackId: string;
  workoutId: string;
  title: string;
  ctx?: WorkoutContext | null;
  backLabel?: string | null;
}) {
  const completion = useWorkoutCompletion(workoutId, ctx);

  function handleTimeUpdate(e: Event) {
    if (completion.completed) return;
    const el = e.target as HTMLVideoElement;
    if (el.duration > 0 && el.currentTime / el.duration > 0.8) {
      completion.report("watched80");
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
        onEnded={() => completion.report("ended")}
      />
      <CompletionBar state={completion} backLabel={backLabel} />
    </div>
  );
}
