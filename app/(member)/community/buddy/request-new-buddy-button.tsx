"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { leaveAndRematch } from "./actions";

export function RequestNewBuddyButton() {
  const [step, setStep] = useState<"idle" | "confirm" | "loading" | "matched" | "pending">("idle");

  async function handleConfirm() {
    setStep("loading");
    try {
      const res = await leaveAndRematch();
      if (res.paired) {
        setStep("matched");
        setTimeout(() => { window.location.href = "/community/buddy"; }, 1200);
      } else {
        setStep("pending");
        setTimeout(() => { window.location.href = "/community/buddy"; }, 2000);
      }
    } catch {
      setStep("idle");
    }
  }

  if (step === "matched") {
    return <p className="text-center text-sm font-semibold text-primary">Matched! Loading your new buddy…</p>;
  }
  if (step === "pending") {
    return <p className="text-center text-sm text-muted-foreground">You&apos;ve been added to the queue — we&apos;ll pair you as soon as someone becomes available.</p>;
  }
  if (step === "confirm") {
    return (
      <div className="flex items-center justify-center gap-3 text-sm">
        <span className="text-muted-foreground">End this pairing and find a new buddy?</span>
        <button
          onClick={handleConfirm}
          className="font-semibold text-primary hover:underline"
        >
          Yes, find me a new one
        </button>
        <button
          onClick={() => setStep("idle")}
          className="text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={() => setStep("confirm")}
      disabled={step === "loading"}
    >
      {step === "loading" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
      {step === "loading" ? "Finding a new buddy…" : "Request a new buddy"}
    </Button>
  );
}
