"use client";

import { useState, useMemo } from "react";
import { FileText, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Segment = { t: number; text: string };

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TranscriptViewer({ segments }: { segments: Segment[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return segments;
    const q = query.toLowerCase();
    return segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, query]);

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted/60"
      >
        <FileText className="size-4 shrink-0 text-primary" />
        <span className="flex-1 text-sm font-semibold">Transcript</span>
        <span className="text-xs text-muted-foreground">{segments.length} segments</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div>
          {/* Search bar */}
          {segments.length > 10 && (
            <div className="border-b px-4 py-2">
              <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-1.5">
                <Search className="size-3.5 shrink-0 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search transcript…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                {query && (
                  <button type="button" onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Segments */}
          <div className="max-h-80 overflow-y-auto px-4 py-3">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No results for "{query}"</p>
            ) : (
              <ul className="space-y-3">
                {filtered.map((seg, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-10 shrink-0 font-mono text-xs text-primary opacity-80 pt-0.5">
                      {formatTime(seg.t)}
                    </span>
                    <p className="flex-1 text-sm leading-relaxed text-foreground/85">
                      {query.trim()
                        ? highlightMatch(seg.text, query)
                        : seg.text}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function highlightMatch(text: string, query: string) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-amber-200 px-0.5 dark:bg-amber-800">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}
