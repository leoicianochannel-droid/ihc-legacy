"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Trash2, Wand2 } from "lucide-react";
import { saveTranscript, autoGenerateTranscript } from "./actions";

type Segment = { t: number; text: string };

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Parse "M:SS text", "[MM:SS] text", "HH:MM:SS text" → { t, text } */
function parseTranscript(raw: string): Segment[] {
  const lines = raw.split("\n");
  const segments: Segment[] = [];
  const tsRegex = /^\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\s*/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(tsRegex);
    if (match) {
      const hasHours = match[3] !== undefined;
      const h = hasHours ? parseInt(match[1]) : 0;
      const m = hasHours ? parseInt(match[2]) : parseInt(match[1]);
      const s = hasHours ? parseInt(match[3]) : parseInt(match[2]);
      const t = h * 3600 + m * 60 + s;
      const text = trimmed.slice(match[0].length).trim();
      if (text) segments.push({ t, text });
    } else if (segments.length > 0) {
      // No timestamp — append to previous segment
      segments[segments.length - 1].text += " " + trimmed;
    }
  }
  return segments;
}

function segmentsToText(segments: Segment[]): string {
  return segments.map((s) => `${formatTime(s.t)} ${s.text}`).join("\n");
}

export function TranscriptEditor({
  workoutId,
  initialTranscript,
}: {
  workoutId: string;
  initialTranscript: Segment[];
}) {
  const [raw, setRaw] = useState(segmentsToText(initialTranscript));
  const [preview, setPreview] = useState<Segment[]>(initialTranscript);
  const [showPreview, setShowPreview] = useState(initialTranscript.length > 0);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleParse() {
    const segments = parseTranscript(raw);
    setPreview(segments);
    setShowPreview(true);
    setSaved(false);
  }

  function handleSave() {
    const segments = parseTranscript(raw);
    setError(null);
    startTransition(async () => {
      const res = await saveTranscript(workoutId, segments);
      if (!res.ok) { setError(res.error ?? "Save failed."); return; }
      setPreview(segments);
      setSaved(true);
    });
  }

  function handleAutoGenerate() {
    setError(null);
    setGenerateMsg("Requesting captions from Cloudflare… this takes up to 45s for short videos, longer for longer ones.");
    setGenerating(true);
    startTransition(async () => {
      const res = await autoGenerateTranscript(workoutId);
      setGenerating(false);
      if (res.ok && res.segments) {
        const text = segmentsToText(res.segments);
        setRaw(text);
        setPreview(res.segments);
        setShowPreview(true);
        setSaved(true);
        setGenerateMsg(`✅ Generated ${res.segments.length} segments and saved automatically.`);
      } else if (res.pending) {
        setGenerateMsg(`⏳ ${res.error}`);
      } else {
        setError(res.error ?? "Generation failed.");
        setGenerateMsg(null);
      }
    });
  }

  function handleClear() {
    setRaw("");
    setPreview([]);
    setShowPreview(false);
    setSaved(false);
    startTransition(async () => {
      await saveTranscript(workoutId, []);
    });
  }

  return (
    <div className="space-y-4">
      {/* Auto-generate button */}
      <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
        <Wand2 className="size-5 shrink-0 text-primary" />
        <div className="flex-1 text-sm">
          <p className="font-semibold">Auto-generate from video</p>
          <p className="text-xs text-muted-foreground">Uses Cloudflare AI to transcribe the audio automatically.</p>
        </div>
        <Button
          type="button"
          variant="gradient"
          size="sm"
          onClick={handleAutoGenerate}
          disabled={generating || isPending}
        >
          {generating ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
          {generating ? "Generating…" : "Generate"}
        </Button>
      </div>
      {generateMsg && (
        <p className="rounded-xl border bg-muted/40 px-3 py-2 text-sm">{generateMsg}</p>
      )}

      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">— or paste manually —</p>

      <textarea
        value={raw}
        onChange={(e) => { setRaw(e.target.value); setSaved(false); }}
        rows={16}
        placeholder={"0:00 Welcome to today's workout!\n1:30 Let's start warming up...\n3:00 Now we'll pick up the pace"}
        className="w-full resize-y rounded-xl border bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-primary/40"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleParse}>
          Preview ({parseTranscript(raw).length} segments)
        </Button>
        <Button type="button" variant="gradient" size="sm" onClick={handleSave} disabled={isPending || !raw.trim()}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
          {saved ? "Saved!" : "Save transcript"}
        </Button>
        {initialTranscript.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={handleClear} className="text-destructive hover:text-destructive">
            <Trash2 className="size-4" /> Clear
          </Button>
        )}
      </div>

      {/* Preview */}
      {showPreview && preview.length > 0 && (
        <div className="max-h-64 overflow-y-auto rounded-xl border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Preview</p>
          <ul className="space-y-2">
            {preview.map((seg, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-10 shrink-0 font-mono text-xs text-primary">{formatTime(seg.t)}</span>
                <span className="flex-1 text-sm">{seg.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
