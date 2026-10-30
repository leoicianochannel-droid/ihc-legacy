"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { Camera } from "lucide-react";

type PhotoEntry = {
  id: string;
  entryDate: string;
  photoUrls: string[];
};

export function PhotoCompare({ entries }: { entries: PhotoEntry[] }) {
  const [leftId, setLeftId] = useState(entries.at(-1)?.id ?? "");
  const [rightId, setRightId] = useState(entries.at(0)?.id ?? "");

  if (entries.length < 2) return null;

  const left = entries.find((e) => e.id === leftId) ?? entries.at(-1)!;
  const right = entries.find((e) => e.id === rightId) ?? entries.at(0)!;

  return (
    <Card>
      <CardContent className="p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Your transformation
        </p>

        {/* Side-by-side photos */}
        <div className="grid grid-cols-2 gap-3">
          <PhotoSlot entry={left} label="Before" />
          <PhotoSlot entry={right} label="After" highlight />
        </div>

        {/* Pickers */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Before
            </label>
            <select
              value={leftId}
              onChange={(e) => setLeftId(e.target.value)}
              className="w-full rounded-lg border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/40"
            >
              {entries.map((e) => (
                <option key={e.id} value={e.id}>
                  {formatDate(e.entryDate, { month: "short", day: "numeric", year: "numeric" })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              After
            </label>
            <select
              value={rightId}
              onChange={(e) => setRightId(e.target.value)}
              className="w-full rounded-lg border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/40"
            >
              {entries.map((e) => (
                <option key={e.id} value={e.id}>
                  {formatDate(e.entryDate, { month: "short", day: "numeric", year: "numeric" })}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PhotoSlot({
  entry,
  label,
  highlight,
}: {
  entry: PhotoEntry;
  label: string;
  highlight?: boolean;
}) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const url = entry.photoUrls[photoIdx];

  return (
    <div>
      <div className="overflow-hidden rounded-xl aspect-[3/4] bg-muted relative">
        {url ? (
          <img src={url} alt={label} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Camera className="size-8 text-muted-foreground/30" />
          </div>
        )}
        {entry.photoUrls.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {entry.photoUrls.map((_, i) => (
              <button
                key={i}
                onClick={() => setPhotoIdx(i)}
                className={`size-1.5 rounded-full transition-colors ${i === photoIdx ? "bg-white" : "bg-white/50"}`}
              />
            ))}
          </div>
        )}
      </div>
      <p className={`mt-1.5 text-center text-xs ${highlight ? "font-semibold text-primary" : "text-muted-foreground"}`}>
        {formatDate(entry.entryDate, { month: "short", day: "numeric" })}
      </p>
    </div>
  );
}
