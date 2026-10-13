"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { deleteWorkout, deleteRecipe, deleteChallenge } from "./actions";

type Kind = "workout" | "recipe" | "challenge";

export function DeleteButton({ kind, id, title }: { kind: Kind; id: string; title: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      // Auto-reset the confirm state after 3s of inactivity
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    startTransition(async () => {
      if (kind === "workout") await deleteWorkout(id);
      else if (kind === "recipe") await deleteRecipe(id);
      else if (kind === "challenge") await deleteChallenge(id);
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={confirming ? "destructive" : "ghost"}
      onClick={handleClick}
      disabled={isPending}
      title={confirming ? `Really delete "${title}"?` : `Delete ${title}`}
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <>
          <Trash2 className="size-4" />
          {confirming && <span className="ml-1 text-xs">Confirm?</span>}
        </>
      )}
    </Button>
  );
}
