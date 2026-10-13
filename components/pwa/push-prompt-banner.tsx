"use client";

import { useEffect, useState } from "react";
import { Bell, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "push_prompt_dismissed_until";
const DISMISS_DAYS = 7;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "hidden" | "visible" | "busy" | "done";

export function PushPromptBanner() {
  const [state, setState] = useState<State>("hidden");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission !== "default") return;

    // Hidden for DISMISS_DAYS after user taps "Not now"
    const until = localStorage.getItem(DISMISS_KEY);
    if (until && Date.now() < parseInt(until, 10)) return;

    setState("visible");
  }, []);

  async function handleEnable() {
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState("hidden");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY) as unknown as BufferSource,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setState("done");
      setTimeout(() => setState("hidden"), 2500);
    } catch {
      setState("hidden");
    }
  }

  function handleDismiss() {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
    setState("hidden");
  }

  if (state === "hidden") return null;

  if (state === "done") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-700 mb-4">
        <Bell className="size-4 shrink-0" />
        Notifications enabled — you're all set!
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-primary/8 border border-primary/20 px-4 py-3 mb-4">
      <Bell className="size-5 shrink-0 text-primary" />
      <p className="flex-1 text-sm text-foreground">
        <span className="font-semibold">Stay on track</span> — enable notifications for daily reminders, streak alerts, and challenge updates.
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="gradient"
          onClick={handleEnable}
          disabled={state === "busy"}
          className="h-8 text-xs"
        >
          {state === "busy" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            "Enable"
          )}
        </Button>
        <button
          onClick={handleDismiss}
          className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
