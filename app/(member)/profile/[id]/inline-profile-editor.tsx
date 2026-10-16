"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Pencil, MapPin } from "lucide-react";
import { saveProfile } from "@/app/(member)/settings/actions";

export function InlineProfileEditor({
  initialBio,
  initialLocation,
}: {
  initialBio: string | null;
  initialLocation: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(initialBio ?? "");
  const [location, setLocation] = useState(initialLocation ?? "");
  const [saved, setSaved] = useState({ bio: initialBio ?? "", location: initialLocation ?? "" });
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await saveProfile({ bio, location });
      setSaved({ bio, location });
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="group relative mt-2">
        {saved.location && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            {saved.location}
          </p>
        )}
        {saved.bio && (
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">{saved.bio}</p>
        )}
        {!saved.location && !saved.bio && (
          <p className="text-sm text-muted-foreground italic">No bio yet.</p>
        )}
        <button
          onClick={() => setEditing(true)}
          className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Pencil className="size-3" /> Edit
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-3">
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Where are you from?</label>
        <Input
          className="mt-1"
          placeholder="e.g. Austin, TX"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={100}
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">About me</label>
        <Textarea
          className="mt-1"
          placeholder="Tell the community a little about yourself…"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={400}
          rows={3}
        />
        <p className="mt-0.5 text-xs text-muted-foreground">{bio.length}/400</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setEditing(false); setBio(saved.bio); setLocation(saved.location); }}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
