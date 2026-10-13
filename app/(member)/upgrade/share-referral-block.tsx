"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Share2 } from "lucide-react";

export function ShareReferralBlock({
  code,
  shareLink,
  firstName,
}: {
  code: string;
  shareLink: string;
  firstName: string;
}) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const message = `Hey! I've been doing this hooping community and it's been wild for me — you get free workout videos, recipes, challenges, and a built-in accountability partner. First month is on me if you use my code: ${code}. Here's the link: ${shareLink}`;

  async function copy(text: string, setter: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch {
      // browsers without clipboard API — silently fall back
    }
  }

  async function nativeShare() {
    if (typeof navigator === "undefined" || !("share" in navigator)) {
      copy(message, setCopiedLink);
      return;
    }
    try {
      await navigator.share({
        title: "Infinity Hoop Community",
        text: message,
        url: shareLink,
      });
    } catch {
      // user cancelled or not supported
    }
  }

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Your personal code
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-center font-display text-3xl font-bold tracking-wider text-primary">
          {code}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => copy(code, setCopiedCode)}
          aria-label="Copy code"
        >
          {copiedCode ? <Check className="text-primary" /> : <Copy />}
        </Button>
      </div>

      <div className="mt-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Share link
        </div>
        <div className="mt-2 flex gap-2">
          <Input value={shareLink} readOnly className="text-xs" />
          <Button
            variant="outline"
            size="icon"
            onClick={() => copy(shareLink, setCopiedLink)}
            aria-label="Copy link"
          >
            {copiedLink ? <Check className="text-primary" /> : <Copy />}
          </Button>
        </div>
      </div>

      <Button variant="gradient" size="lg" className="mt-6 w-full" onClick={nativeShare}>
        <Share2 /> Share with a friend
      </Button>

      <div className="mt-4 rounded-xl bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
        <div className="font-semibold text-foreground">Preview of what they'll see:</div>
        <p className="mt-1 italic">"{message}"</p>
      </div>
    </div>
  );
}
