"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Gift, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { saveMilestone, deleteMilestone, seedDefaultMilestones, type MilestoneFormData } from "./actions";
import type { GiftMilestoneRow } from "@/lib/db/schema";

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

const EMPTY_FORM: MilestoneFormData = {
  key: "",
  dayThreshold: 30,
  label: "",
  fullLabel: "",
  description: "",
  emoji: "🎁",
  retailValue: "",
  requiresShipping: false,
  imageUrl: null,
  isActive: true,
};

function MilestoneForm({
  initial,
  onSave,
  onCancel,
  isNew,
}: {
  initial: MilestoneFormData;
  onSave: (data: MilestoneFormData) => void;
  onCancel: () => void;
  isNew: boolean;
}) {
  const [form, setForm] = useState<MilestoneFormData>(initial);

  function set(field: keyof MilestoneFormData, value: string | number | boolean | null) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-generate key from label when creating new
      if (isNew && field === "label" && typeof value === "string") {
        next.key = slugify(value);
      }
      return next;
    });
  }

  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold">Emoji</label>
          <input
            value={form.emoji}
            onChange={(e) => set("emoji", e.target.value)}
            className="w-16 rounded-lg border bg-background px-2 py-1.5 text-center text-lg"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold">Day threshold</label>
          <input
            type="number"
            min={1}
            value={form.dayThreshold}
            onChange={(e) => set("dayThreshold", parseInt(e.target.value) || 1)}
            className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold">Short label <span className="text-muted-foreground">(shown in banner)</span></label>
          <input
            value={form.label}
            onChange={(e) => set("label", e.target.value)}
            placeholder="Detox Tea"
            className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold">Full label <span className="text-muted-foreground">(shown on gifts page)</span></label>
          <input
            value={form.fullLabel}
            onChange={(e) => set("fullLabel", e.target.value)}
            placeholder="Free 30-Day Detox Tea"
            className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
            className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold">Retail value <span className="text-muted-foreground">(e.g. $39.99)</span></label>
          <input
            value={form.retailValue}
            onChange={(e) => set("retailValue", e.target.value)}
            placeholder="$39.99"
            className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold">Product image URL <span className="text-muted-foreground">(optional)</span></label>
          <input
            value={form.imageUrl ?? ""}
            onChange={(e) => set("imageUrl", e.target.value || null)}
            placeholder="https://..."
            className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <div className="flex items-center gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.requiresShipping}
              onChange={(e) => set("requiresShipping", e.target.checked)}
              className="size-4 accent-primary"
            />
            Requires shipping
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
              className="size-4 accent-primary"
            />
            Active
          </label>
        </div>
        {isNew && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Key (auto-generated)</label>
            <input
              value={form.key}
              onChange={(e) => set("key", slugify(e.target.value))}
              className="w-full rounded-lg border bg-muted px-3 py-1.5 text-xs font-mono text-muted-foreground"
            />
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => onSave(form)} disabled={!form.label || !form.key || !form.dayThreshold}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export function GiftsAdminClient({ rows }: { rows: GiftMilestoneRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave(id: string | null, data: MilestoneFormData) {
    startTransition(async () => {
      await saveMilestone(id, data);
      setEditingId(null);
      setIsAdding(false);
    });
  }

  function handleDelete(id: string, label: string) {
    if (!confirm(`Delete "${label}"? This can't be undone. Existing claims won't be affected.`)) return;
    startTransition(async () => {
      await deleteMilestone(id);
    });
  }

  function handleSeed() {
    if (!confirm("Seed the 3 default milestones? Existing ones with the same key will be skipped.")) return;
    startTransition(async () => {
      await seedDefaultMilestones();
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {rows.length === 0
              ? "No milestones yet — add one or seed the defaults."
              : `${rows.length} milestone${rows.length !== 1 ? "s" : ""} · sorted by day threshold`}
          </p>
        </div>
        <div className="flex gap-2">
          {rows.length === 0 && (
            <Button variant="outline" size="sm" onClick={handleSeed} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : "Seed defaults"}
            </Button>
          )}
          <Button size="sm" onClick={() => { setIsAdding(true); setEditingId(null); }} disabled={isAdding}>
            <Plus className="size-4 mr-1" /> Add milestone
          </Button>
        </div>
      </div>

      {/* Add form */}
      {isAdding && (
        <Card className="border-primary/30">
          <CardContent className="p-4">
            <p className="font-semibold text-sm">New milestone</p>
            <MilestoneForm
              initial={EMPTY_FORM}
              onSave={(data) => handleSave(null, data)}
              onCancel={() => setIsAdding(false)}
              isNew
            />
          </CardContent>
        </Card>
      )}

      {/* Milestone list */}
      {rows.map((row) => (
        <Card key={row.id} className={!row.isActive ? "opacity-60" : undefined}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl leading-none">{row.emoji}</span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{row.fullLabel}</span>
                    <Badge variant="outline" className="text-[10px]">Day {row.dayThreshold}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{row.retailValue}</Badge>
                    {row.requiresShipping && (
                      <Badge className="text-[10px] bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">Ships</Badge>
                    )}
                    {!row.isActive && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactive</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{row.description}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/60">key: {row.key}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => setEditingId(editingId === row.id ? null : row.id)}
                >
                  {editingId === row.id
                    ? <ChevronUp className="size-4" />
                    : <><Pencil className="size-3.5 mr-1" />Edit</>
                  }
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(row.id, row.label)}
                  disabled={isPending}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>

            {editingId === row.id && (
              <MilestoneForm
                initial={{
                  key: row.key,
                  dayThreshold: row.dayThreshold,
                  label: row.label,
                  fullLabel: row.fullLabel,
                  description: row.description,
                  emoji: row.emoji,
                  retailValue: row.retailValue,
                  requiresShipping: row.requiresShipping,
                  imageUrl: row.imageUrl,
                  isActive: row.isActive,
                }}
                onSave={(data) => handleSave(row.id, data)}
                onCancel={() => setEditingId(null)}
                isNew={false}
              />
            )}
          </CardContent>
        </Card>
      ))}

      {rows.length === 0 && !isAdding && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center text-muted-foreground">
          <Gift className="size-8 opacity-40" />
          <p className="text-sm">No gift milestones configured.</p>
          <p className="text-xs">Members will see the 3 built-in default milestones until you add custom ones.</p>
        </div>
      )}
    </div>
  );
}
