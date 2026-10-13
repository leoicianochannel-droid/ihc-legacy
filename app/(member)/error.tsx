"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function MemberError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[member area] unhandled error:", error.message, error.digest);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertTriangle className="size-12 text-amber-500" />
      <h2 className="font-display text-2xl font-bold">Something went wrong</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        We hit an unexpected error. Your data is safe — try refreshing or head back to the dashboard.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">ref: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <Button variant="gradient" onClick={reset}>
          <RefreshCw className="size-4" /> Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
