"use client";

import { useState, useTransition } from "react";
import { sendNudge } from "./actions";
import { Button } from "@/components/ui/button";
import { Send, Loader2, CheckCircle2 } from "lucide-react";

export function NudgeButton({
  memberId,
  memberEmail,
  memberFirstName,
}: {
  memberId: string;
  memberEmail: string | null;
  memberFirstName: string | null;
}) {
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleNudge() {
    startTransition(async () => {
      await sendNudge(memberId, memberEmail, memberFirstName);
      setSent(true);
    });
  }

  if (sent) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
        <CheckCircle2 className="size-3.5" /> Sent
      </span>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={handleNudge} disabled={isPending} className="h-7 px-2.5 text-xs">
      {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <><Send className="mr-1 size-3" /> Nudge</>}
    </Button>
  );
}
