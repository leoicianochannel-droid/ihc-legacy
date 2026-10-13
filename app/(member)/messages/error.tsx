"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageCircle, RefreshCw } from "lucide-react";

export default function MessagesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[messages] error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <MessageCircle className="size-12 text-muted-foreground" />
      <h2 className="font-display text-2xl font-bold">Something went wrong</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        We couldn't load this conversation. This sometimes happens if the other member's account isn't fully set up yet.
      </p>
      <div className="flex gap-3">
        <Button variant="gradient" onClick={reset}>
          <RefreshCw className="size-4" /> Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/community">Back to community</Link>
        </Button>
      </div>
    </div>
  );
}
