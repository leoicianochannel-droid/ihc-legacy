"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setMemberRole, toggleBetaTester, resetMemberPlan } from "./actions";
import { Loader2 } from "lucide-react";

export function MemberActionButtons({
  userId,
  isAdmin,
  isBeta,
}: {
  userId: string;
  isAdmin: boolean;
  isBeta: boolean;
}) {
  const [roleState, setRoleState] = useState<"idle" | "pending" | "done">("idle");
  const [betaState, setBetaState] = useState<"idle" | "pending" | "done">("idle");
  const [resetState, setResetState] = useState<"idle" | "confirm" | "pending" | "done">("idle");
  const [isPending, startTransition] = useTransition();

  function handleRole() {
    setRoleState("pending");
    startTransition(async () => {
      await setMemberRole(userId, isAdmin ? "member" : "admin");
      setRoleState("done");
      setTimeout(() => setRoleState("idle"), 2000);
    });
  }

  function handleBeta() {
    setBetaState("pending");
    startTransition(async () => {
      await toggleBetaTester(userId, !isBeta);
      setBetaState("done");
      setTimeout(() => setBetaState("idle"), 2000);
    });
  }

  function handleResetConfirm() {
    setResetState("pending");
    startTransition(async () => {
      await resetMemberPlan(userId);
      setResetState("done");
      setTimeout(() => setResetState("idle"), 3000);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* Role toggle */}
      <Button
        variant="outline"
        size="sm"
        disabled={roleState === "pending"}
        onClick={handleRole}
      >
        {roleState === "pending" ? (
          <><Loader2 className="mr-1.5 size-3 animate-spin" /> Working…</>
        ) : roleState === "done" ? (
          "Done ✓"
        ) : isAdmin ? (
          "Demote to member"
        ) : (
          "Make admin"
        )}
      </Button>

      {/* Beta toggle */}
      <Button
        variant="outline"
        size="sm"
        disabled={betaState === "pending"}
        onClick={handleBeta}
      >
        {betaState === "pending" ? (
          <><Loader2 className="mr-1.5 size-3 animate-spin" /> Working…</>
        ) : betaState === "done" ? (
          "Done ✓"
        ) : isBeta ? (
          "Remove beta"
        ) : (
          "Grant beta (30d)"
        )}
      </Button>

      {/* Reset plan — two-step confirm */}
      {resetState === "idle" && (
        <Button variant="outline" size="sm" onClick={() => setResetState("confirm")}>
          Reset plan
        </Button>
      )}
      {resetState === "confirm" && (
        <div className="flex items-center gap-1.5 rounded-xl border border-amber-400/60 bg-amber-50 px-3 py-1.5 dark:bg-amber-950/30">
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Sure?</span>
          <button
            className="rounded-md bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-amber-600"
            onClick={handleResetConfirm}
          >
            Yes, reset
          </button>
          <button
            className="text-[11px] text-muted-foreground hover:underline"
            onClick={() => setResetState("idle")}
          >
            cancel
          </button>
        </div>
      )}
      {resetState === "pending" && (
        <Button variant="outline" size="sm" disabled>
          <Loader2 className="mr-1.5 size-3 animate-spin" /> Resetting…
        </Button>
      )}
      {resetState === "done" && (
        <Button variant="outline" size="sm" disabled className="border-green-400 text-green-600">
          Reset ✓ — they&apos;ll redo plan setup
        </Button>
      )}
    </div>
  );
}
