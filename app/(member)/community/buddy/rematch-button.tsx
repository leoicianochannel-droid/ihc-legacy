"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestRematch } from "./actions";

export function RematchButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "matched" | "no-match" | "error">("idle");

  async function handleClick() {
    setLoading(true);
    setStatus("idle");
    try {
      const res = await requestRematch();
      if (res.paired) {
        setStatus("matched");
        setTimeout(() => {
          window.location.href = "/community/buddy";
        }, 1200);
      } else {
        setStatus("no-match");
      }
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  if (status === "matched") {
    return (
      <p className="text-center text-sm font-semibold text-primary">
        You&apos;ve been matched! Loading your buddy…
      </p>
    );
  }

  return (
    <div className="space-y-2 text-center">
      <Button
        onClick={handleClick}
        disabled={loading}
        variant="outline"
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        {loading ? "Looking for a match…" : "Find me a match now"}
      </Button>
      {status === "no-match" && (
        <p className="text-xs text-muted-foreground">
          No free partners right now — we&apos;ll match you automatically as soon as someone becomes available.
        </p>
      )}
      {status === "error" && (
        <p className="text-xs text-destructive">
          Something went wrong. Please try again in a moment.
        </p>
      )}
    </div>
  );
}
