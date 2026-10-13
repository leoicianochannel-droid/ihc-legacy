"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Heart, Loader2 } from "lucide-react";
import { saveRecipe } from "@/app/(member)/dashboard/actions";

interface SaveRecipeButtonProps {
  recipeId: string;
  savedThisWeek: boolean;
}

export function SaveRecipeButton({ recipeId, savedThisWeek }: SaveRecipeButtonProps) {
  const [saved, setSaved] = useState(savedThisWeek);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    if (saved) return;
    startTransition(async () => {
      const res = await saveRecipe(recipeId);
      if (res.ok) setSaved(true);
    });
  }

  return (
    <Button
      size="sm"
      variant={saved ? "secondary" : "ghost"}
      onClick={handleSave}
      disabled={pending || saved}
      className={saved ? "text-primary" : ""}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Heart className={`size-4 ${saved ? "fill-primary text-primary" : ""}`} />
      )}
      {saved ? "Saved" : "Add to week"}
    </Button>
  );
}
