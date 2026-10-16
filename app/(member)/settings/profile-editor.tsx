"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { saveProfile } from "./actions";

export function ProfileEditor({
  initialBio,
  initialLocation,
}: {
  initialBio: string | null;
  initialLocation: string | null;
}) {
  const [bio, setBio] = useState(initialBio ?? "");
  const [location, setLocation] = useState(initialLocation ?? "");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await saveProfile({ bio, location });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-semibold">Where are you from?</label>
        <Input
          className="mt-1.5"
          placeholder="e.g. Austin, TX"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={100}
        />
      </div>
      <div>
        <label className="text-sm font-semibold">About me</label>
        <Textarea
          className="mt-1.5"
          placeholder="Tell the community a little about yourself…"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={400}
          rows={3}
        />
        <p className="mt-1 text-xs text-muted-foreground">{bio.length}/400</p>
      </div>
      <Button onClick={handleSave} disabled={isPending} size="sm">
        {saved ? "Saved ✓" : isPending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
