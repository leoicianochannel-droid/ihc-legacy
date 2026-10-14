"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { UserPlus, X } from "lucide-react";
import { addMember, type AddMemberInput, type AddMemberResult } from "./actions";

// Default free-access end date: 30 days from today
function defaultFreeUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

const ACCESS_OPTIONS: { value: AddMemberInput["access"]; label: string; hint: string }[] = [
  { value: "none", label: "Regular member", hint: "Pays through Skio like everyone else" },
  { value: "until", label: "Free until…", hint: "Free access until a date you pick" },
  { value: "forever", label: "Free forever", hint: "Comped, never needs to pay" },
];

export function AddMemberForm() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [access, setAccess] = useState<AddMemberInput["access"]>("none");
  const [freeUntil, setFreeUntil] = useState(defaultFreeUntil());
  const [note, setNote] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AddMemberResult | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setResult(null);
    startTransition(async () => {
      const res = await addMember({
        email,
        firstName,
        lastName,
        access,
        freeUntil: access === "until" ? freeUntil : undefined,
        note,
        sendInvite,
      });
      setResult(res);
      if (res.ok) {
        setEmail("");
        setFirstName("");
        setLastName("");
        setNote("");
      }
    });
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <Button variant="gradient" onClick={() => { setOpen(true); setResult(null); }}>
          <UserPlus className="mr-1.5 size-4" /> Add member
        </Button>
        {result && (
          <p className={`text-sm ${result.ok ? "text-primary" : "text-destructive"}`}>{result.msg}</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Add a member</h2>
          <p className="text-xs text-muted-foreground">
            Creates their account now. When they sign up with this email, they&apos;re
            linked to it automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="add-email">Email</Label>
          <Input
            id="add-email"
            type="email"
            required
            placeholder="member@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="add-first">First name (optional)</Label>
          <Input
            id="add-first"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="add-last">Last name (optional)</Label>
          <Input
            id="add-last"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Access</legend>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
          {ACCESS_OPTIONS.map((o) => (
            <label
              key={o.value}
              className={`cursor-pointer rounded-xl border p-3 text-sm transition-colors ${
                access === o.value ? "border-primary bg-primary/5" : "hover:border-primary/40"
              }`}
            >
              <input
                type="radio"
                name="access"
                value={o.value}
                checked={access === o.value}
                onChange={() => setAccess(o.value)}
                className="sr-only"
              />
              <span className="font-semibold">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.hint}</span>
            </label>
          ))}
        </div>
        {access === "until" && (
          <div className="mt-3 max-w-xs">
            <Label htmlFor="add-until">Free access through</Label>
            <Input
              id="add-until"
              type="date"
              required
              value={freeUntil}
              onChange={(e) => setFreeUntil(e.target.value)}
              className="mt-1"
            />
          </div>
        )}
      </fieldset>

      <div className="mt-4">
        <Label htmlFor="add-note">Note (optional)</Label>
        <Input
          id="add-note"
          placeholder="e.g. 'Influencer partner' or 'Customer service comp'"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1"
        />
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={sendInvite}
          onChange={(e) => setSendInvite(e.target.checked)}
          className="size-4 accent-primary"
        />
        Email them a link to create their account
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit" variant="gradient" disabled={!email.trim() || isPending}>
          {isPending ? "Adding…" : "Add member"}
        </Button>
        {result && (
          <p className={`text-sm ${result.ok ? "text-primary" : "text-destructive"}`}>{result.msg}</p>
        )}
      </div>
    </form>
  );
}
