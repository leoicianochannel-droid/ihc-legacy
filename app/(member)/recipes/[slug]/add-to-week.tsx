"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Check, Plus } from "lucide-react";
import { addRecipeToWeek } from "./actions";

export function AddToWeekButton({ recipeId }: { recipeId: string }) {
  const [added, setAdded] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      await addRecipeToWeek(recipeId);
      setAdded(true);
    });
  }

  return (
    <Button onClick={onClick} disabled={isPending || added} variant={added ? "outline" : "gradient"} size="lg">
      {added ? <><Check /> Added to this week</> : <><Plus /> Add to this week's grocery list</>}
    </Button>
  );
}
