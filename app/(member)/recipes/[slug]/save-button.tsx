"use client";

import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleSaveRecipe } from "./actions";

export function SaveButton({
  recipeId,
  initialSaved,
}: {
  recipeId: string;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await toggleSaveRecipe(recipeId);
      if ("saved" in result) setSaved(result.saved);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={saved ? "Unsave recipe" : "Save recipe"}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all",
        saved
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-foreground/70 hover:border-primary/50 hover:text-primary",
        pending && "opacity-60"
      )}
    >
      <Bookmark className={cn("size-4", saved && "fill-primary")} />
      {saved ? "Saved" : "Save Recipe"}
    </button>
  );
}
