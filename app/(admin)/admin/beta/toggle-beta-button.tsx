"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { setUserBetaStatus } from "./actions";

export function ToggleBetaButton({
  userId,
  email,
  isBeta,
}: {
  userId: string;
  email: string;
  isBeta: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function click() {
    if (!confirm(`Remove ${email} from beta? They'll need a paid subscription when the paywall is on.`)) return;
    startTransition(async () => {
      await setUserBetaStatus(userId, !isBeta);
    });
  }

  return (
    <Button onClick={click} disabled={isPending} size="sm" variant="outline">
      {isPending ? <Loader2 className="size-3 animate-spin" /> : "Remove"}
    </Button>
  );
}
