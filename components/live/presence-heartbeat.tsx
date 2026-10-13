"use client";

import { useEffect } from "react";

/**
 * Heartbeats the server every 30s while the user is on a workout page.
 * Sends an immediate ping on mount, then every 30s while the tab is visible.
 * On unmount we fire `/api/live/end` via sendBeacon so the row clears even
 * during fast page transitions.
 *
 * If neither runs (force-quit, network drop), the server prunes after 2 min.
 */
export function PresenceHeartbeat({ workoutId }: { workoutId: string | null }) {
  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        await fetch("/api/live/ping", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ workoutId }),
          keepalive: true,
        });
      } catch {
        // Network blip — wait for next tick.
      }
    };

    ping();
    const handle = setInterval(ping, 30 * 1000);

    // Visibility-aware: if user backgrounds the tab for a long time, we
    // simply skip pings. When they return we fire one immediately.
    const onVisible = () => {
      if (!document.hidden) ping();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(handle);
      document.removeEventListener("visibilitychange", onVisible);
      // sendBeacon survives navigation/unload better than fetch.
      try {
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon("/api/live/end");
        } else {
          fetch("/api/live/end", { method: "POST", keepalive: true });
        }
      } catch {}
    };
  }, [workoutId]);

  return null;
}
