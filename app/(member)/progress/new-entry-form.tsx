"use client";

import { useState, useTransition, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveEntry } from "./actions";
import { upload as blobUpload } from "@vercel/blob/client";
import { Camera, X, Loader2 } from "lucide-react";

function PhotoUploader({
  urls,
  onChange,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const MAX = 3;

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files).slice(0, MAX - urls.length)) {
        const blob = await blobUpload(`progress/${Date.now()}-${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/upload-photo-token",
        });
        newUrls.push(blob.url);
      }
      onChange([...urls, ...newUrls]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <Label>Progress photos (optional, private)</Label>
      <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
        Front, side, back — up to 3. Only you can see these.
      </p>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <div key={u} className="relative size-20 overflow-hidden rounded-xl border">
            <img src={u} alt="" className="size-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(urls.filter((_, j) => j !== i))}
              className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        {urls.length < MAX && (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={uploading}
            className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <>
                <Camera className="size-5" />
                <span className="text-[10px] font-medium">Add photo</span>
              </>
            )}
          </button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

export function NewEntryForm() {
  const [weight, setWeight] = useState("");
  const [mood, setMood] = useState("");
  const [energy, setEnergy] = useState("");
  const [note, setNote] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function submit() {
    startTransition(async () => {
      await saveEntry({
        weightLb: weight ? parseFloat(weight) : null,
        mood: mood ? parseInt(mood, 10) : null,
        energyLevel: energy ? parseInt(energy, 10) : null,
        note: note || null,
        photoUrls,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setNote("");
      setPhotoUrls([]);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log today's check-in</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Weight (lb)</Label>
          <Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
        <div>
          <Label>Mood (1–5)</Label>
          <Input type="number" min={1} max={5} value={mood} onChange={(e) => setMood(e.target.value)} />
        </div>
        <div>
          <Label>Energy (1–5)</Label>
          <Input type="number" min={1} max={5} value={energy} onChange={(e) => setEnergy(e.target.value)} />
        </div>
        <div className="sm:col-span-3">
          <Label>Note (private)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="How are you feeling today?" />
        </div>
        <div className="sm:col-span-3">
          <PhotoUploader urls={photoUrls} onChange={setPhotoUrls} />
        </div>
        <div className="sm:col-span-3">
          <Button onClick={submit} disabled={isPending} variant="gradient">
            {saved ? "Saved ✓" : isPending ? "Saving..." : "Save entry"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
