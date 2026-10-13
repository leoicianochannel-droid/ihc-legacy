"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RefreshPlanButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleRefresh() {
    setState("loading");
    try {
      const res = await fetch("/api/member/refresh-plan", { method: "POST" });
      if (!res.ok) throw new Error("failed");
      setState("done");
      setTimeout(() => router.refresh(), 800);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  if (state === "done") {
    return (
      <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
        <CheckCircle2 className="size-4" /> Workouts refreshed!
      </span>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRefresh}
      disabled={state === "loading"}
      className="gap-2 text-muted-foreground hover:text-foreground"
    >
      {state === "loading" ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <RefreshCw className="size-4" />
      )}
      {state === "loading" ? "Refreshing…" : state === "error" ? "Try again" : "Refresh workouts"}
    </Button>
  );
}
