"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { joinPremiumWaitlist } from "./actions";

const FEATURES = [
  { id: "coach_checkin", label: "Weekly 1:1 coach check-in" },
  { id: "zoom_call", label: "Monthly Zoom coaching call" },
  { id: "ai_plan", label: "AI-personalized plan" },
];

export function PremiumWaitlistForm({ defaultEmail }: { defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [selected, setSelected] = useState<string[]>(FEATURES.map((f) => f.id));
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    if (!email) return;
    startTransition(async () => {
      await joinPremiumWaitlist({ email, features: selected, note });
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="size-4 text-primary" />
        Join the Premium waitlist
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        We'll only open Premium to members who join this list first. Tell us
        what you'd want most and we'll build it for you.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="waitlist-email">Email</Label>
          <Input
            id="waitlist-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label>What are you most excited about?</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {FEATURES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => toggle(f.id)}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all ${
                  selected.includes(f.id)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:border-primary/40"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <Label htmlFor="waitlist-note">Anything else we should know? <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Textarea
          id="waitlist-note"
          placeholder="e.g. 'I have a nagging lower back thing,' or 'I only have 20 min in the morning'"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1"
          rows={2}
        />
      </div>

      <Button
        variant="gradient"
        onClick={submit}
        disabled={!email || isPending}
        className="mt-4"
      >
        {isPending ? "Joining..." : "Save my spot"}
      </Button>
    </div>
  );
}
