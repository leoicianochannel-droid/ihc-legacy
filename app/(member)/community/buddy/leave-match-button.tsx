"use client";

import { useState } from "react";
import { leaveMatch } from "./actions";

export function LeaveMatchButton() {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLeave() {
    setLoading(true);
    await leaveMatch();
  }

  if (confirming) {
    return (
      <div className="flex items-center justify-center gap-3 text-sm">
        <span className="text-muted-foreground">End this pairing?</span>
        <button
          onClick={handleLeave}
          disabled={loading}
          className="font-semibold text-destructive hover:underline disabled:opacity-50"
        >
          {loading ? "Ending…" : "Yes, end it"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
    >
      Leave this pairing
    </button>
  );
}
