"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { markUserAsBetaTester } from "./actions";

// Default expiration: 90 days from today
function defaultExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d.toISOString().slice(0, 10);
}

export function BetaInviteForm() {
  const [email, setEmail] = useState("");
  const [expiresOn, setExpiresOn] = useState(defaultExpiry());
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function submit() {
    if (!email.trim() || !expiresOn) return;
    setResult(null);
    startTransition(async () => {
      const res = await markUserAsBetaTester({
        email: email.trim().toLowerCase(),
        expiresOn,
        note,
      });
      setResult(res);
      if (res.ok) {
        setEmail("");
        setNote("");
        setExpiresOn(defaultExpiry());
      }
    });
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            placeholder="member@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Free access expires on</Label>
          <Input
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>
      <div className="mt-3">
        <Label>Note (optional)</Label>
        <Input
          placeholder="e.g. 'Skool top 10 — Jan beta cohort'"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1"
        />
      </div>
      <Button onClick={submit} disabled={!email || !expiresOn || isPending} variant="gradient" className="mt-4">
        {isPending ? "Granting access..." : "Grant free access"}
      </Button>
      {result && (
        <p className={`mt-2 text-sm ${result.ok ? "text-primary" : "text-destructive"}`}>
          {result.msg}
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        On the expiration date, this user will need to subscribe via Shopify to keep access.
      </p>
    </div>
  );
}
