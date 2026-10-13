"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { upload as blobUpload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  addContestEntry,
  updateContestEntry,
  deleteContestEntry,
  enrollInContest,
} from "./actions";
import {
  Video,
  Star,
  Ruler,
  Trophy,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  ImagePlus,
  X,
  Check,
  ChevronDown,
  TrendingUp,
} from "lucide-react";

/* ── Types ── */
export interface Enrollment {
  id: string;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  startWaistInches: number | null;
  wonCategories: string[] | null;
  enrolledAt: Date;
}

export interface Entry {
  id: string;
  entryType: string;
  reelUrl: string | null;
  reelPlatform: string | null;
  reelViewCount: number | null;
  title: string | null;
  story: string | null;
  photoUrls: string[] | null;
  waistInches: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/* ── Shared photo uploader ── */
function PhotoUploader({
  urls,
  onChange,
  max = 2,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const blob = await blobUpload(`contest/${Date.now()}-${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/upload-photo-token",
      });
      onChange([...urls, blob.url]);
    } finally {
      setUploading(false);
    }
  }

  return (
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
      {urls.length < max && (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={uploading}
          className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          <span className="text-[10px]">Photo</span>
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* ── Enrollment form (shown before they sign up) ── */
export function EnrollForm({
  challengeId,
  challengeTitle,
  userFirstName,
}: {
  challengeId: string;
  challengeTitle: string;
  userFirstName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [waist, setWaist] = useState("");

  function handleSubmit() {
    startTransition(async () => {
      await enrollInContest(challengeId, {
        instagramHandle: instagram || undefined,
        tiktokHandle: tiktok || undefined,
        startWaistInches: waist ? parseFloat(waist) : undefined,
      });
    });
  }

  return (
    <div className="mx-auto max-w-lg py-12">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
          <Trophy className="size-8 text-primary" />
        </div>
        <h1 className="font-display text-3xl font-bold">Join the Prize Contest</h1>
        <p className="mt-2 text-muted-foreground">
          Hey {userFirstName}! Sign up once, then log your reels, wins, and measurements
          throughout the challenge. We'll pick winners automatically at the end.
        </p>
      </div>

      {/* Prize summary */}
      <div className="mb-6 grid grid-cols-2 gap-2">
        {[
          { label: "Best Non-Scale Victory", icon: Star },
          { label: "Best Reel, Most Viral", icon: Video },
          { label: "Best Transformation", icon: Trophy },
          { label: "Most Inches Off Waist", icon: Ruler },
        ].map(({ label, icon: Icon }) => (
          <div key={label} className="flex items-center gap-2 rounded-xl border bg-card p-3 text-xs font-medium">
            <Icon className="size-4 shrink-0 text-primary" />
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p className="mb-6 text-center text-sm font-semibold text-yellow-600 dark:text-yellow-400">
        $500 per category · $2,000 total prize pool
      </p>

      {/* Form */}
      <div className="space-y-4 rounded-2xl border bg-card p-6">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Starting waist measurement (inches)
          </label>
          <input
            type="number"
            step="0.25"
            min={0}
            value={waist}
            onChange={(e) => setWaist(e.target.value)}
            placeholder="e.g. 34.5"
            className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Measure at your belly button. You'll log your final measurement at the end.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Instagram handle
            </label>
            <div className="flex items-center rounded-xl border bg-background focus-within:ring-2 focus-within:ring-primary/40">
              <span className="pl-3 text-sm text-muted-foreground">@</span>
              <input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value.replace("@", ""))}
                placeholder="yourhandle"
                className="flex-1 bg-transparent px-2 py-2.5 text-sm focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              TikTok handle
            </label>
            <div className="flex items-center rounded-xl border bg-background focus-within:ring-2 focus-within:ring-primary/40">
              <span className="pl-3 text-sm text-muted-foreground">@</span>
              <input
                value={tiktok}
                onChange={(e) => setTiktok(e.target.value.replace("@", ""))}
                placeholder="yourhandle"
                className="flex-1 bg-transparent px-2 py-2.5 text-sm focus:outline-none"
              />
            </div>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isPending}
          variant="gradient"
          size="lg"
          className="w-full"
        >
          {isPending ? <><Loader2 className="mr-2 size-4 animate-spin" /> Signing up…</> : "Join the contest →"}
        </Button>
      </div>
    </div>
  );
}

/* ── Individual entry cards ── */
function ReelCard({ entry, onDelete }: { entry: Entry; onDelete: () => void }) {
  const [deleting, startDelete] = useTransition();
  const [editing, setEditing] = useState(false);
  const [views, setViews] = useState(entry.reelViewCount?.toString() ?? "");
  const [saving, startSave] = useTransition();

  function saveViews() {
    startSave(async () => {
      await updateContestEntry(entry.id, { reelViewCount: parseInt(views, 10) });
      setEditing(false);
    });
  }

  const platformIcon = entry.reelPlatform === "tiktok" ? "TikTok" : entry.reelPlatform === "youtube" ? "YouTube" : "Instagram";

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="shrink-0 text-xs">{platformIcon}</Badge>
            {entry.title && <span className="truncate text-sm font-semibold">{entry.title}</span>}
          </div>
          <a
            href={entry.reelUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View reel <ExternalLink className="size-3" />
          </a>
        </div>
        <button
          onClick={() => startDelete(async () => { await deleteContestEntry(entry.id); onDelete(); })}
          disabled={deleting}
          className="shrink-0 text-muted-foreground hover:text-destructive"
        >
          {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        {editing ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              type="number"
              value={views}
              onChange={(e) => setViews(e.target.value)}
              className="w-32 rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <Button size="sm" variant="gradient" onClick={saveViews} disabled={saving}>
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
            </Button>
            <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/20">
            <TrendingUp className="size-3.5" />
            {entry.reelViewCount != null ? `${entry.reelViewCount.toLocaleString()} views` : "Add view count"}
          </button>
        )}
        <span className="text-xs text-muted-foreground">
          {new Date(entry.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

function NsvCard({ entry, onDelete }: { entry: Entry; onDelete: () => void }) {
  const [deleting, startDelete] = useTransition();
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {entry.title && <p className="font-semibold">{entry.title}</p>}
          {entry.story && <p className="mt-1 text-sm text-muted-foreground line-clamp-3">{entry.story}</p>}
          {entry.photoUrls?.length ? (
            <div className="mt-2 flex gap-2">
              {entry.photoUrls.map((u) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                  <img src={u} className="h-14 w-14 rounded-lg object-cover" alt="" />
                </a>
              ))}
            </div>
          ) : null}
        </div>
        <button
          onClick={() => startDelete(async () => { await deleteContestEntry(entry.id); onDelete(); })}
          disabled={deleting}
          className="shrink-0 text-muted-foreground hover:text-destructive"
        >
          {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString()}</p>
    </div>
  );
}

function MeasurementCard({ entry, onDelete }: { entry: Entry; onDelete: () => void }) {
  const [deleting, startDelete] = useTransition();
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
          <Ruler className="size-5 text-primary" />
        </div>
        <div>
          <div className="font-display text-xl font-bold">{entry.waistInches}"</div>
          <div className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString()}</div>
        </div>
      </div>
      <button
        onClick={() => startDelete(async () => { await deleteContestEntry(entry.id); onDelete(); })}
        disabled={deleting}
        className="text-muted-foreground hover:text-destructive"
      >
        {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </button>
    </div>
  );
}

/* ── Add-entry inline forms ── */
function AddReelForm({
  enrollmentId,
  onSaved,
}: {
  enrollmentId: string;
  onSaved: () => void;
}) {
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [views, setViews] = useState("");
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    if (!url.trim()) return;
    startTransition(async () => {
      const res = await addContestEntry(enrollmentId, {
        entryType: "reel",
        reelUrl: url,
        reelPlatform: platform,
        reelViewCount: views ? parseInt(views, 10) : undefined,
        title: title || undefined,
      });
      if (res.success) {
        setUrl(""); setViews(""); setTitle("");
        onSaved();
      }
    });
  }

  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reel URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.instagram.com/reel/..."
            className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube">YouTube</option>
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">View count</label>
          <input
            type="number"
            value={views}
            onChange={(e) => setViews(e.target.value)}
            placeholder="e.g. 12500"
            className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Caption (optional)</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's the reel about?"
            className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>
      <Button onClick={save} disabled={isPending || !url.trim()} variant="gradient" size="sm">
        {isPending ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Plus className="mr-1 size-3" />}
        Add reel
      </Button>
    </div>
  );
}

function AddNsvForm({ enrollmentId, onSaved }: { enrollmentId: string; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  function save() {
    if (!title.trim() && !story.trim()) return;
    startTransition(async () => {
      const res = await addContestEntry(enrollmentId, {
        entryType: "nsv",
        title: title || undefined,
        story: story || undefined,
        photoUrls: photos.length ? photos : undefined,
      });
      if (res.success) { setTitle(""); setStory(""); setPhotos([]); onSaved(); }
    });
  }

  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your win (required)</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. I can hoop for 5 minutes straight!"
          className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tell us more (optional)</label>
        <textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          rows={3}
          placeholder="What happened? How did it feel?"
          className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      <PhotoUploader urls={photos} onChange={setPhotos} max={1} />
      <Button onClick={save} disabled={isPending || (!title.trim() && !story.trim())} variant="gradient" size="sm">
        {isPending ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Plus className="mr-1 size-3" />}
        Log this win
      </Button>
    </div>
  );
}

function AddMeasurementForm({ enrollmentId, onSaved }: { enrollmentId: string; onSaved: () => void }) {
  const [inches, setInches] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    if (!inches) return;
    startTransition(async () => {
      const res = await addContestEntry(enrollmentId, {
        entryType: "measurement",
        waistInches: parseFloat(inches),
      });
      if (res.success) { setInches(""); onSaved(); }
    });
  }

  return (
    <div className="flex items-end gap-3 rounded-xl border bg-muted/30 p-4">
      <div className="flex-1 space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Waist measurement (inches)</label>
        <input
          type="number"
          step="0.25"
          value={inches}
          onChange={(e) => setInches(e.target.value)}
          placeholder="e.g. 33.5"
          className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      <Button onClick={save} disabled={isPending || !inches} variant="gradient" size="sm" className="mb-0.5">
        {isPending ? <Loader2 className="size-3 animate-spin" /> : "Log it"}
      </Button>
    </div>
  );
}

function AddTransformationForm({ enrollmentId, existing, onSaved }: { enrollmentId: string; existing: Entry | undefined; onSaved: () => void }) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [story, setStory] = useState(existing?.story ?? "");
  const [photos, setPhotos] = useState<string[]>(existing?.photoUrls ?? []);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      let res;
      if (existing) {
        res = await updateContestEntry(existing.id, { title, story, photoUrls: photos.length ? photos : undefined });
      } else {
        res = await addContestEntry(enrollmentId, { entryType: "transformation", title, story, photoUrls: photos.length ? photos : undefined });
      }
      if (res.success) onSaved();
    });
  }

  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Headline (optional)</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. From barely moving to hooping every day"
          className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your story</label>
        <textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          rows={5}
          placeholder="Tell your full transformation — the highs, lows, and everything in between..."
          className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Before + after photos (up to 2)</label>
        <PhotoUploader urls={photos} onChange={setPhotos} max={2} />
      </div>
      <Button onClick={save} disabled={isPending} variant="gradient" size="sm">
        {isPending ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Check className="mr-1 size-3" />}
        {existing ? "Update story" : "Save story"}
      </Button>
    </div>
  );
}

/* ── Tab section wrapper ── */
function Section({
  icon: Icon,
  title,
  count,
  addLabel,
  children,
  addForm,
  onSaved = () => {},
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  addLabel: string;
  children: React.ReactNode;
  addForm: React.ReactNode;
  onSaved?: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="size-5 text-primary" />
          <h2 className="font-display text-lg font-bold">{title}</h2>
          {count > 0 && (
            <Badge variant="secondary" className="text-xs">{count}</Badge>
          )}
        </div>
        <Button
          size="sm"
          variant={showAdd ? "outline" : "gradient"}
          onClick={() => setShowAdd((v) => !v)}
        >
          {showAdd ? <><X className="mr-1 size-3" /> Cancel</> : <><Plus className="mr-1 size-3" /> {addLabel}</>}
        </Button>
      </div>
      {showAdd && React.cloneElement(addForm as React.ReactElement<{ onSaved: () => void }>, {
        onSaved: () => { setShowAdd(false); onSaved(); },
      })}
      {children}
    </div>
  );
}

import React from "react";

/* ── Main dashboard ── */
export function ContestDashboard({
  enrollment,
  entries,
  challengeTitle,
  challengeEndsAt,
  userFirstName,
}: {
  enrollment: Enrollment;
  entries: Entry[];
  challengeTitle: string;
  challengeEndsAt: Date | null;
  userFirstName: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "reels" | "wins" | "measurements" | "story">("overview");
  const [localEntries, setLocalEntries] = useState<Entry[]>(entries);

  const reels = localEntries.filter((e) => e.entryType === "reel");
  const wins = localEntries.filter((e) => e.entryType === "nsv");
  const measurements = localEntries.filter((e) => e.entryType === "measurement").sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const transformation = localEntries.find((e) => e.entryType === "transformation");

  const latestMeasurement = measurements.at(-1);
  const inchesLost =
    enrollment.startWaistInches != null && latestMeasurement?.waistInches != null
      ? enrollment.startWaistInches - latestMeasurement.waistInches
      : null;

  const daysLeft = challengeEndsAt
    ? Math.max(0, Math.ceil((challengeEndsAt.getTime() - Date.now()) / 86400000))
    : null;

  function refresh() {
    router.refresh();
  }

  const TABS = [
    { key: "overview" as const, label: "Overview" },
    { key: "reels" as const, label: "Reels", count: reels.length },
    { key: "wins" as const, label: "Wins", count: wins.length },
    { key: "measurements" as const, label: "Measurements", count: measurements.length },
    { key: "story" as const, label: "Story", dot: !!transformation },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl hoop-gradient-bold p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold opacity-75">Prize Contest</p>
            <h1 className="mt-0.5 font-display text-2xl font-bold">{challengeTitle}</h1>
          </div>
          {daysLeft !== null && (
            <div className="text-right">
              <div className="font-display text-3xl font-bold">{daysLeft}</div>
              <div className="text-xs font-semibold opacity-75">days left</div>
            </div>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Reels", value: reels.length },
            { label: "Wins logged", value: wins.length },
            { label: "Measurements", value: measurements.length },
            {
              label: "Inches lost",
              value: inchesLost !== null && inchesLost > 0 ? `${inchesLost.toFixed(2)}"` : "—",
            },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-white/15 px-3 py-2 backdrop-blur">
              <div className="font-display text-xl font-bold">{s.value}</div>
              <div className="text-xs opacity-75">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border bg-muted/40 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              tab === t.key
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {"count" in t && t.count! > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                {t.count}
              </span>
            )}
            {"dot" in t && t.dot && (
              <span className="size-2 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Log content throughout the challenge — we'll automatically pick winners at the end based on what you submit.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: Video, label: "Reels", desc: "Submit your hoop videos", count: reels.length, onClick: () => setTab("reels") },
              { icon: Star, label: "Wins", desc: "Log non-scale victories", count: wins.length, onClick: () => setTab("wins") },
              { icon: Ruler, label: "Measurements", desc: "Track your waist inches", count: measurements.length, onClick: () => setTab("measurements") },
              { icon: Trophy, label: "Story", desc: "Write your transformation", count: transformation ? 1 : 0, onClick: () => setTab("story") },
            ].map((c) => (
              <button
                key={c.label}
                onClick={c.onClick}
                className="flex items-center gap-4 rounded-2xl border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <c.icon className="size-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold">{c.label}</div>
                  <div className="text-xs text-muted-foreground">{c.desc}</div>
                </div>
                {c.count > 0 && (
                  <Badge variant="secondary" className="ml-auto shrink-0">{c.count}</Badge>
                )}
              </button>
            ))}
          </div>

          {enrollment.instagramHandle && (
            <div className="rounded-xl border bg-card px-4 py-3 text-sm">
              <span className="font-semibold">Your handles: </span>
              <span className="text-muted-foreground">
                {enrollment.instagramHandle && `@${enrollment.instagramHandle} (Instagram)`}
                {enrollment.tiktokHandle && ` · @${enrollment.tiktokHandle} (TikTok)`}
              </span>
            </div>
          )}
        </div>
      )}

      {tab === "reels" && (
        <Section
          icon={Video}
          title="Your Reels"
          count={reels.length}
          addLabel="Add reel"
          addForm={<AddReelForm enrollmentId={enrollment.id} onSaved={refresh} />}
          onSaved={refresh}
        >
          {reels.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No reels submitted yet — add your first hoop video!
            </p>
          ) : (
            <div className="space-y-3">
              {reels.map((e) => (
                <ReelCard
                  key={e.id}
                  entry={e}
                  onDelete={() => setLocalEntries((prev) => prev.filter((x) => x.id !== e.id))}
                />
              ))}
            </div>
          )}
        </Section>
      )}

      {tab === "wins" && (
        <Section
          icon={Star}
          title="Non-Scale Victories"
          count={wins.length}
          addLabel="Log a win"
          addForm={<AddNsvForm enrollmentId={enrollment.id} onSaved={refresh} />}
          onSaved={refresh}
        >
          {wins.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No wins logged yet — celebrate every victory, big or small!
            </p>
          ) : (
            <div className="space-y-3">
              {wins.map((e) => (
                <NsvCard
                  key={e.id}
                  entry={e}
                  onDelete={() => setLocalEntries((prev) => prev.filter((x) => x.id !== e.id))}
                />
              ))}
            </div>
          )}
        </Section>
      )}

      {tab === "measurements" && (
        <Section
          icon={Ruler}
          title="Waist Measurements"
          count={measurements.length}
          addLabel="Log measurement"
          addForm={<AddMeasurementForm enrollmentId={enrollment.id} onSaved={refresh} />}
          onSaved={refresh}
        >
          <div className="space-y-3">
            {enrollment.startWaistInches != null && (
              <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                <div className="text-sm">
                  <span className="font-semibold">Starting measurement</span>
                  <span className="ml-2 text-muted-foreground">(at enrollment)</span>
                </div>
                <div className="font-display text-xl font-bold text-primary">{enrollment.startWaistInches}"</div>
              </div>
            )}

            {measurements.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Log measurements weekly to track your progress.
              </p>
            ) : (
              measurements.map((e) => (
                <MeasurementCard
                  key={e.id}
                  entry={e}
                  onDelete={() => setLocalEntries((prev) => prev.filter((x) => x.id !== e.id))}
                />
              ))
            )}

            {inchesLost !== null && inchesLost > 0 && (
              <div className="rounded-xl bg-primary/10 px-4 py-3 text-center">
                <span className="font-display text-2xl font-bold text-primary">{inchesLost.toFixed(2)}"</span>
                <span className="ml-2 text-sm font-semibold text-primary">lost so far</span>
              </div>
            )}
          </div>
        </Section>
      )}

      {tab === "story" && (
        <Section
          icon={Trophy}
          title="Transformation Story"
          count={transformation ? 1 : 0}
          addLabel={transformation ? "Edit story" : "Write story"}
          addForm={<AddTransformationForm enrollmentId={enrollment.id} existing={transformation} onSaved={refresh} />}
          onSaved={refresh}
        >
          {transformation ? (
            <div className="rounded-xl border bg-card p-4">
              {transformation.title && <p className="font-semibold text-lg">{transformation.title}</p>}
              {transformation.story && <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{transformation.story}</p>}
              {transformation.photoUrls?.length ? (
                <div className="mt-3 flex gap-2">
                  {transformation.photoUrls.map((u) => (
                    <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                      <img src={u} className="h-24 w-24 rounded-xl object-cover" alt="" />
                    </a>
                  ))}
                </div>
              ) : null}
              <p className="mt-3 text-xs text-muted-foreground">
                Last updated {new Date(transformation.updatedAt).toLocaleDateString()}
              </p>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Share your transformation story — what changed for you during these 30 days?
            </p>
          )}
        </Section>
      )}
    </div>
  );
}
