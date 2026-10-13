"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { claimGift } from "./actions";
import type { GiftMilestone } from "@/lib/gifts";
import { CheckCircle2, Loader2, Package, Sparkles } from "lucide-react";

export function ClaimForm({
  milestone,
  onClose,
}: {
  milestone: GiftMilestone;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    data.set("milestoneKey", milestone.key);
    setError(null);
    startTransition(async () => {
      const result = await claimGift(data);
      if (result?.error) {
        setError(result.error);
      } else {
        setDone(true);
      }
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="size-9 text-primary" />
        </div>
        <div>
          <h3 className="font-display text-xl font-bold">You&apos;re all set!</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {milestone.requiresShipping
              ? "We'll ship your gift within 3–5 business days. Check your email for tracking."
              : "Your free month has been noted — we'll apply it to your next billing cycle."}
          </p>
        </div>
        <Button onClick={onClose} variant="outline">Close</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="milestoneKey" value={milestone.key} />

      <div className="flex items-center gap-3 rounded-2xl bg-primary/5 p-4">
        <span className="text-3xl">{milestone.emoji}</span>
        <div>
          <div className="font-semibold">{milestone.fullLabel}</div>
          <div className="text-xs text-muted-foreground">{milestone.description}</div>
        </div>
      </div>

      {milestone.requiresShipping ? (
        <>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Package className="size-4 text-primary" /> Where should we ship it?
          </p>

          <div>
            <Label htmlFor="shippingName">Full name *</Label>
            <Input id="shippingName" name="shippingName" className="mt-1" placeholder="Jane Smith" required />
          </div>
          <div>
            <Label htmlFor="shippingLine1">Address line 1 *</Label>
            <Input id="shippingLine1" name="shippingLine1" className="mt-1" placeholder="123 Main St" required />
          </div>
          <div>
            <Label htmlFor="shippingLine2">Address line 2</Label>
            <Input id="shippingLine2" name="shippingLine2" className="mt-1" placeholder="Apt 4B (optional)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="shippingCity">City *</Label>
              <Input id="shippingCity" name="shippingCity" className="mt-1" placeholder="Austin" required />
            </div>
            <div>
              <Label htmlFor="shippingState">State *</Label>
              <Input id="shippingState" name="shippingState" className="mt-1" placeholder="TX" maxLength={2} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="shippingZip">ZIP code *</Label>
              <Input id="shippingZip" name="shippingZip" className="mt-1" placeholder="78701" required />
            </div>
            <div>
              <Label htmlFor="shippingCountry">Country</Label>
              <Input id="shippingCountry" name="shippingCountry" className="mt-1" defaultValue="US" />
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
          <Sparkles className="mb-1 inline size-4 text-primary" /> No shipping needed — we&apos;ll apply your free month to your next billing cycle automatically.
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" variant="gradient" className="w-full gap-2" disabled={isPending}>
        {isPending ? <><Loader2 className="size-4 animate-spin" /> Processing…</> : <>Claim my gift <Sparkles className="size-4" /></>}
      </Button>
    </form>
  );
}
