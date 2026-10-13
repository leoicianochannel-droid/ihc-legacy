"use client";

import { useState } from "react";
import { Copy, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  referralUrl: string | null;
  referredCount: number;
}

export function InviteCopyCard({ referralUrl, referredCount }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const el = document.createElement("textarea");
      el.value = referralUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Stats */}
      <Card>
        <CardContent className="flex items-center gap-4 py-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Users className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold font-display">{referredCount}</p>
            <p className="text-sm text-muted-foreground">
              {referredCount === 1 ? "friend invited" : "friends invited"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Link + copy */}
      <Card>
        <CardContent className="py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your invite link
          </p>
          {referralUrl ? (
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 rounded-xl border bg-muted/40 px-3 py-2">
                <p className="truncate text-sm text-foreground">{referralUrl}</p>
              </div>
              <Button
                type="button"
                variant={copied ? "default" : "outline"}
                size="sm"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="mr-1.5 size-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 size-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your referral link is being generated — check back in a moment.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
