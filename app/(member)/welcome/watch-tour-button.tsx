"use client";

import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { WelcomeTourModal } from "@/components/member/welcome-tour-modal";

/**
 * Pink button on the Welcome / Help hero that opens the tour modal on demand.
 * Unlike the auto-show modal, this one is fully dismissible without recording
 * any "skipped" state — it's a rewatch, not a first watch.
 */
export function WatchTourButton({
  videoUid,
  customerCode,
  durationSec,
  embedUrl,
}: {
  videoUid: string;
  customerCode: string | null;
  durationSec: number | null;
  embedUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const mins = durationSec ? Math.ceil(durationSec / 60) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-white/90"
      >
        <PlayCircle className="size-4 text-primary" />
        Watch the welcome tour
        {mins ? <span className="text-muted-foreground">· {mins} min</span> : null}
      </button>

      {open && (
        // Render via portal-ish overlay; the modal handles its own dismissal.
        // We hook into its mark-watched action by listening for revalidate
        // (the action itself handles state in the DB). For the rewatch case
        // we just want a way to close without changing watched state, so we
        // wrap it and override onClose behavior.
        <RewatchOverlay onClose={() => setOpen(false)}>
          <WelcomeTourModal
            videoUid={videoUid}
            customerCode={customerCode}
            durationSec={durationSec}
            embedUrl={embedUrl}
            closable={true}
            onClose={() => setOpen(false)}
          />
        </RewatchOverlay>
      )}
    </>
  );
}

function RewatchOverlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  // The inner modal lays itself out fixed-positioned and is dismissed by its
  // own buttons (which call server actions). Tapping the dark backdrop also
  // closes it. We use a sibling close trigger so the dismiss-on-watch works
  // even if the user hits "Skip for now" — both server actions will redirect
  // the user via revalidatePath and the modal unmounts on next render.
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      // Render as a sibling — the inner modal handles its own backdrop
      className="contents"
    >
      {children}
    </div>
  );
}
