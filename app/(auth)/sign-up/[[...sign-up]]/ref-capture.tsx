"use client";

import { useEffect } from "react";
import { Gift } from "lucide-react";

/**
 * Shows a friendly banner when the user lands here via a referral link,
 * and stashes the code in localStorage so we can pick it up after Clerk
 * completes signup and route-sends to /onboarding.
 */
export function RefCapture({ code }: { code: string }) {
  useEffect(() => {
    try {
      localStorage.setItem("ih_ref_code", code);
    } catch {}
  }, [code]);

  return (
    <div className="mb-4 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-sm">
      <div className="flex items-center gap-2 font-semibold text-primary">
        <Gift className="size-4" />
        Your first month is on {formatReferrerName(code)}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        You were invited with code <span className="font-mono font-bold">{code}</span>.
        Finish signing up to claim your free month.
      </p>
    </div>
  );
}

function formatReferrerName(code: string): string {
  const prefix = code.split("-")[0];
  if (!prefix || prefix === "HOOP") return "a friend";
  const pretty = prefix.charAt(0) + prefix.slice(1).toLowerCase();
  return pretty;
}
