"use client";

import { useState, useTransition } from "react";
import { updateTimezone } from "./actions";
import { Button } from "@/components/ui/button";

const TIMEZONES = [
  // United States
  { label: "Hawaii (HST)", value: "Pacific/Honolulu" },
  { label: "Alaska (AKST)", value: "America/Anchorage" },
  { label: "Pacific (PST/PDT)", value: "America/Los_Angeles" },
  { label: "Mountain (MST/MDT)", value: "America/Denver" },
  { label: "Mountain – Arizona (MST)", value: "America/Phoenix" },
  { label: "Central (CST/CDT)", value: "America/Chicago" },
  { label: "Eastern (EST/EDT)", value: "America/New_York" },
  // Canada
  { label: "Atlantic (AST/ADT)", value: "America/Halifax" },
  { label: "Newfoundland (NST)", value: "America/St_Johns" },
  // International
  { label: "London (GMT/BST)", value: "Europe/London" },
  { label: "Central Europe (CET/CEST)", value: "Europe/Paris" },
  { label: "Eastern Europe (EET)", value: "Europe/Athens" },
  { label: "Moscow (MSK)", value: "Europe/Moscow" },
  { label: "Gulf (GST)", value: "Asia/Dubai" },
  { label: "India (IST)", value: "Asia/Kolkata" },
  { label: "Bangkok (ICT)", value: "Asia/Bangkok" },
  { label: "Singapore/KL (SGT)", value: "Asia/Singapore" },
  { label: "Japan/Korea (JST)", value: "Asia/Tokyo" },
  { label: "Sydney (AEST/AEDT)", value: "Australia/Sydney" },
  { label: "Auckland (NZST/NZDT)", value: "Pacific/Auckland" },
];

export function TimezoneSelector({ current }: { current: string }) {
  const [value, setValue] = useState(current);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await updateTimezone(value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <select
        value={value}
        onChange={(e) => { setValue(e.target.value); setSaved(false); }}
        className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
      >
        {TIMEZONES.map((tz) => (
          <option key={tz.value} value={tz.value}>{tz.label}</option>
        ))}
        {/* Fallback if their current tz isn't in the list */}
        {!TIMEZONES.find((tz) => tz.value === current) && (
          <option value={current}>{current}</option>
        )}
      </select>
      <Button
        onClick={handleSave}
        disabled={isPending || value === current}
        size="sm"
        variant={saved ? "outline" : "default"}
        className="shrink-0"
      >
        {saved ? "Saved ✓" : isPending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
