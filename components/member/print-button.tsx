"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

function isIosPwa(): boolean {
  if (typeof window === "undefined") return false;
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Mac") && "ontouchend" in document);
  return ios && standalone;
}

export function PrintButton() {
  async function handleClick() {
    // iOS PWA: window.print() is unreliable — open the native share sheet
    // instead, which includes Print, Save to Files, etc.
    if (isIosPwa()) {
      try {
        await navigator.share({ title: document.title, url: window.location.href });
        return;
      } catch {
        // cancelled — fall through to print
      }
    }
    window.print();
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      data-print-hide
    >
      <Printer className="size-4 mr-1.5" />
      Print / Save
    </Button>
  );
}
