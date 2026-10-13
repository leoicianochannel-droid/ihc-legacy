"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

export function FoundingMemberBonusButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<{ credited: number; bonusWorkouts: number; message?: string } | null>(null);

  async function handleApply() {
    if (!confirm("Credit all onboarded founding members with 10 bonus workout points? This is safe to run — it skips anyone who already got the bonus.")) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/admin/founding-member-bonus", { method: "POST" });
      const data = await res.json();
      setResult(data);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Card className="mt-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <Star className="size-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">Founding Member Bonus</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Credit all onboarded Skool migrants with 10 bonus workout points toward their tier. Safe to run multiple times — skips anyone already credited.
            </p>
            {status === "done" && result && (
              <p className="mt-1 text-xs font-semibold text-amber-700">
                {result.message ?? `✓ Credited ${result.credited} founding members with ${result.bonusWorkouts} bonus workouts each.`}
              </p>
            )}
            {status === "error" && (
              <p className="mt-1 text-xs font-semibold text-destructive">Something went wrong — try again.</p>
            )}
          </div>
        </div>
        <Button
          onClick={handleApply}
          disabled={status === "loading" || status === "done"}
          variant="outline"
          className="shrink-0 border-amber-300 hover:bg-amber-100"
        >
          {status === "loading" ? "Applying…" : status === "done" ? "Applied ✓" : "Apply bonus"}
        </Button>
      </CardContent>
    </Card>
  );
}
