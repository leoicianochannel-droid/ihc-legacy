"use client";

import { useState } from "react";
import { Copy, Check, Tag } from "lucide-react";

export function DiscountCodeReveal({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border-2 border-primary/30 bg-primary/5">
      <div className="flex items-center gap-2 border-b border-primary/20 px-4 py-2.5">
        <Tag className="size-4 text-primary" />
        <p className="text-sm font-bold text-primary">Your reward — nice work! 🎉</p>
      </div>
      <div className="p-4">
        <p className="text-xs text-muted-foreground mb-3">
          Use this code at checkout for <strong>{label}</strong>:
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-xl border-2 border-dashed border-primary/40 bg-background px-4 py-2.5 text-center">
            <span className="font-mono text-xl font-extrabold tracking-widest text-primary">
              {code}
            </span>
          </div>
          <button
            onClick={copy}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border-2 border-primary/30 bg-background transition-colors hover:border-primary hover:bg-primary/5"
            title="Copy code"
          >
            {copied ? (
              <Check className="size-4 text-green-600" />
            ) : (
              <Copy className="size-4 text-primary" />
            )}
          </button>
        </div>
        {copied && (
          <p className="mt-2 text-center text-xs font-semibold text-green-600">Copied!</p>
        )}
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Valid at infinityhoop.com · single use
        </p>
      </div>
    </div>
  );
}
