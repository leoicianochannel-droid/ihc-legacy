"use client";

import { useEffect, useState } from "react";
import { X, Share, Plus, Download } from "lucide-react";

/**
 * "Install our app" prompt. Adapts to the platform:
 *  - Already installed (display-mode: standalone) → never shows.
 *  - Android / desktop Chromium → uses the native `beforeinstallprompt` event
 *    so the prompt button triggers Chrome's real install dialog.
 *  - iOS Safari → no programmatic install API, so we walk users through the
 *    "Share → Add to Home Screen" flow with a small visual hint.
 *
 * Dismissals are remembered in localStorage so we don't nag.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "ih_install_dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari quirk
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPad on iOS 13+ identifies as Mac, so detect by touch-ability too.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) !== null;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [bipEvent, setBipEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return;

    // Android / desktop Chromium path
    const handler = (e: Event) => {
      e.preventDefault();
      setBipEvent(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS path — show the prompt after a small delay so it doesn't feel intrusive
    const iosTimer = isIos()
      ? window.setTimeout(() => setShow(true), 4000)
      : null;

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  function dismiss() {
    setShow(false);
    setShowIosHint(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  async function install() {
    if (bipEvent) {
      try {
        await bipEvent.prompt();
        await bipEvent.userChoice;
      } catch {}
      dismiss();
      return;
    }
    if (isIos()) {
      setShowIosHint(true);
      dismiss();
    }
  }

  if (!show) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+88px)] md:pb-6"
      role="dialog"
      aria-live="polite"
    >
      <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-primary/20 bg-background p-4 shadow-2xl ring-1 ring-primary/10">
        {!showIosHint ? (
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white">
              <Download className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold">
                Add Infinity Hoop to your home screen
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                One-tap workouts, recipes, and check-ins. No app store needed.
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-sm font-bold">
                Add to Home Screen
              </p>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss"
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>
            <ol className="mt-3 space-y-2 text-xs">
              <li className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  1
                </span>
                <span>
                  Tap the <Share className="inline size-3.5 align-text-bottom" /> Share button at the bottom of Safari
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  2
                </span>
                <span>
                  Scroll and tap <Plus className="inline size-3.5 align-text-bottom" /> "Add to Home Screen"
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  3
                </span>
                <span>Tap "Add" — you're done!</span>
              </li>
            </ol>
          </div>
        )}

        {!showIosHint && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={install}
              className="flex-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Install
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-full border px-4 py-2 text-sm font-semibold text-foreground/70 hover:bg-muted"
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
