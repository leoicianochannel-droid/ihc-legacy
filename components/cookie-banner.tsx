"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";

/**
 * Cookie consent banner. Two-button GDPR-friendly pattern: "Accept all" and
 * "Reject non-essential". Choice is stored in localStorage so it survives
 * across visits; also dropped as a non-httpOnly cookie so the server can
 * gate future analytics scripts.
 *
 * We don't ship any third-party analytics today, but the consent value is
 * already in place so when we add them we don't need a second migration.
 */

const STORAGE_KEY = "ih_cookie_consent";
const COOKIE_KEY = "ih_cookie_consent";

type Consent = "accepted" | "rejected";

function readChoice(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "accepted" || v === "rejected" ? v : null;
  } catch {
    return null;
  }
}

function setChoice(value: Consent) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
    // Mirror to a regular cookie (1 year) so server-rendered pages can decide
    // whether to inject analytics tags. Secure in production only — local dev
    // is http.
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_KEY}=${value}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${secure}`;
  } catch {}
}

export function CookieBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Defer one tick so the banner doesn't flash before the SPA hydrates.
    const t = setTimeout(() => {
      if (readChoice() === null) setOpen(true);
    }, 600);
    return () => clearTimeout(t);
  }, []);

  function accept() {
    setChoice("accepted");
    setOpen(false);
  }

  function reject() {
    setChoice("rejected");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      // Sits above the mobile bottom nav (which is z-40) and below the
      // welcome modal (z-100). Safe-area padding so it clears the home indicator.
      className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+88px)] md:pb-4"
    >
      <div className="w-full max-w-2xl rounded-3xl border bg-background p-4 shadow-2xl ring-1 ring-primary/10 md:p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Cookie className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold md:text-base">
              We use cookies to keep you signed in and make the app work.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Essential cookies are always on. We don't run third-party
              analytics or advertising trackers. Read more in our{" "}
              <Link href="/cookies" className="font-semibold text-primary underline-offset-2 hover:underline">
                Cookie Policy
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-semibold text-primary underline-offset-2 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
          <button
            type="button"
            onClick={reject}
            aria-label="Dismiss banner"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={reject}
            className="rounded-full border px-4 py-2 text-sm font-semibold text-foreground/70 hover:bg-muted"
          >
            Reject non-essential
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
