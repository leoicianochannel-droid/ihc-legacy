"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyCodeButton({ code, size = "default" }: { code: string; size?: "default" | "lg" }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      variant={size === "lg" ? "gradient" : "outline"}
      size={size === "lg" ? "lg" : "sm"}
      onClick={copy}
      className="gap-2 shrink-0"
    >
      {copied ? (
        <>
          <Check className="size-4" /> Copied!
        </>
      ) : (
        <>
          <Copy className="size-4" /> Copy code
        </>
      )}
    </Button>
  );
}
