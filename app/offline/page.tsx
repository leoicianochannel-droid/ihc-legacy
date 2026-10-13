import { Wifi } from "lucide-react";

export const dynamic = "force-static";

/**
 * Fallback page shown by the service worker when a navigation request fails
 * (no connection). Kept intentionally simple so it's tiny + cacheable on first
 * visit.
 */
export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-12 text-center">
      <div className="inline-flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Wifi className="size-7" />
      </div>
      <h1 className="mt-5 font-display text-3xl font-bold">You're offline</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Looks like the connection dropped. Reconnect and we'll pick up where
        you left off — your progress is safe.
      </p>
      <p className="mt-6 text-xs text-muted-foreground">
        Tip: pages you've already visited still work offline. Tap back to
        return.
      </p>
    </div>
  );
}
