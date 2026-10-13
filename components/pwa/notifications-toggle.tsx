"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status =
  | "loading"
  | "unsupported"
  | "blocked"
  | "off"             // supported, granted not yet given
  | "needs-install"   // iOS Safari that hasn't installed PWA yet
  | "on";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  // Convert the VAPID public key from URL-safe base64 to the Uint8Array
  // format that pushManager.subscribe() requires.
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

export function NotificationsToggle() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        // iOS Safari (not standalone) shows the API as missing, but installing
        // the PWA enables it on iOS 16.4+. Distinguish so we can guide users.
        if (isIos() && !isStandalone()) {
          setStatus("needs-install");
        } else {
          setStatus("unsupported");
        }
        return;
      }
      const perm = Notification.permission;
      if (perm === "denied") {
        setStatus("blocked");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? "on" : "off");
      } catch {
        setStatus("off");
      }
    })();
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      // Cast through unknown — some TS lib versions disagree on whether
      // applicationServerKey accepts Uint8Array<ArrayBufferLike>.
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY) as unknown as BufferSource,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("Failed to register subscription");
      setStatus("on");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ─── Render states ───────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Checking…
      </div>
    );
  }

  if (status === "unsupported") {
    return (
      <p className="text-xs text-muted-foreground">
        Push notifications aren't supported in this browser. Try Chrome or
        Safari (with the app installed to your home screen).
      </p>
    );
  }

  if (status === "needs-install") {
    return (
      <p className="text-xs text-muted-foreground">
        On iPhone, push works once you add the app to your home screen. Tap
        the share icon in Safari → Add to Home Screen → reopen from the home
        screen, then come back here to enable.
      </p>
    );
  }

  if (status === "blocked") {
    return (
      <p className="text-xs text-muted-foreground">
        You've blocked notifications for this site. Re-enable them in your
        browser settings (look for the lock icon in the address bar), then
        reload this page.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {status === "on" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={disable}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <BellOff className="mr-1 size-4" />
            )}
            Turn off notifications
          </Button>
        ) : (
          <Button
            type="button"
            variant="gradient"
            size="sm"
            onClick={enable}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Bell className="mr-1 size-4" />
            )}
            Enable notifications
          </Button>
        )}
        {status === "on" && (
          <span className="text-xs font-semibold text-emerald-700">
            ✓ On for this device
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Get a heads-up when someone messages you, comments on your post, or
        when your streak's about to break. Per-device — turn on whichever
        phones you want pinged.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
