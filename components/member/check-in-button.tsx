"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { markDailyCheckIn } from "@/app/(member)/dashboard/actions";
import { cn } from "@/lib/utils";

interface CheckInButtonProps {
  checkedInToday: boolean;
  compact?: boolean;
}

export function CheckInButton({ checkedInToday, compact }: CheckInButtonProps) {
  const [done, setDone] = useState(checkedInToday);
  const [pending, startTransition] = useTransition();

  function handleCheckIn() {
    startTransition(async () => {
      const res = await markDailyCheckIn();
      if (res.ok) setDone(true);
    });
  }

  if (compact) {
    return (
      <button
        onClick={done ? undefined : handleCheckIn}
        disabled={pending}
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl p-3 text-center transition-colors",
          done
            ? "bg-emerald-50 text-emerald-700"
            : "bg-primary text-white hover:bg-primary/90 active:scale-95"
        )}
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <CheckCircle2 className={cn("size-5", done ? "text-emerald-600" : "text-white")} />
        )}
        <p className="mt-1 text-[9px] font-bold uppercase tracking-widest leading-tight">
          {done ? "Checked in!" : "Check in"}
        </p>
      </button>
    );
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
        <CheckCircle2 className="size-4 shrink-0" />
        Checked in today — streak protected 🔥
      </div>
    );
  }

  return (
    <Button
      onClick={handleCheckIn}
      disabled={pending}
      variant="outline"
      className="w-full"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <CheckCircle2 className="size-4" />
      )}
      {pending ? "Checking in…" : "Check in for today"}
    </Button>
  );
}
