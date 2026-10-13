"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createWorkout, getMuxDirectUpload } from "./actions";

/**
 * Admin upload flow:
 *   1. Click "Upload video" → we hit /api (server action) to create a Mux direct upload URL
 *   2. Client PUTs the file directly to Mux
 *   3. Save metadata with the muxUploadId — Mux webhook fills in assetId + playbackId later
 */
export function NewWorkoutForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructor, setInstructor] = useState("");
  const [durationMin, setDurationMin] = useState(20);
  const [intensity, setIntensity] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [bodyFocus, setBodyFocus] = useState<string[]>([]);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const { url, uploadId } = await getMuxDirectUpload();
      const res = await fetch(url, { method: "PUT", body: file });
      if (!res.ok) throw new Error("Upload failed");
      setUploadId(uploadId);
      setFileName(file.name);
    } catch (e) {
      alert("Upload failed: " + (e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function toggleFocus(f: string) {
    setBodyFocus((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }

  function handleSave() {
    if (!uploadId || !title) return;
    startTransition(async () => {
      await createWorkout({
        title,
        description,
        instructor,
        durationMin,
        intensity,
        bodyFocus,
        muxUploadId: uploadId,
      });
      router.push("/admin/content");
    });
  }

  return (
    <Card className="mt-6">
      <CardContent className="space-y-4 p-6">
        <div>
          <Label>Video file</Label>
          <input
            type="file"
            accept="video/*"
            className="mt-2 w-full text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            }}
          />
          {uploading && <p className="mt-2 text-sm text-muted-foreground">Uploading to Mux…</p>}
          {uploadId && <p className="mt-2 text-sm text-primary">✓ {fileName} uploaded. Processing starts in Mux.</p>}
        </div>

        <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Booty Burn 20" className="mt-2" /></div>
        <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-2" /></div>
        <div><Label>Instructor</Label><Input value={instructor} onChange={(e) => setInstructor(e.target.value)} className="mt-2" /></div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Duration (min)</Label>
            <Input type="number" value={durationMin} onChange={(e) => setDurationMin(parseInt(e.target.value))} className="mt-2" />
          </div>
          <div>
            <Label>Intensity</Label>
            <select value={intensity} onChange={(e) => setIntensity(e.target.value as typeof intensity)} className="mt-2 h-11 w-full rounded-xl border bg-background px-4">
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        <div>
          <Label>Body focus</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {["core", "legs", "glutes", "arms", "full-body", "cardio"].map((f) => (
              <button
                type="button"
                key={f}
                onClick={() => toggleFocus(f)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-all ${
                  bodyFocus.includes(f) ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/40"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4">
          <Button onClick={handleSave} disabled={!uploadId || !title || isPending} variant="gradient" size="lg">
            {isPending ? "Saving..." : "Publish workout"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
