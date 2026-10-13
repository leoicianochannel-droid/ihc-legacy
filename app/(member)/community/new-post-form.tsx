"use client";

import { useState, useTransition, useRef, DragEvent } from "react";
import { useUser } from "@clerk/nextjs";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FileText, X, Paperclip, Loader2, Upload, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { upload as blobUpload } from "@vercel/blob/client";
import { GifPicker } from "@/components/community/gif-picker";
import {
  createPost,
  uploadPostAttachments,
  type Attachment,
} from "./actions";

const MAX_FILES_PER_POST = 10;
const MAX_VIDEO_MB = 500;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/mpeg",
  "video/webm",
  "video/3gpp",
  "video/x-m4v",
]);

export function NewPostForm({
  showIntroPrompt = false,
  memberFirstName,
}: {
  showIntroPrompt?: boolean;
  memberFirstName?: string | null;
}) {
  const { user } = useUser();
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    label: string;
    pct: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [stagedGif, setStagedGif] = useState<string | null>(null);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleFiles(files: FileList | File[] | null) {
    if (!files || !files.length) return;
    const list = Array.from(files);
    const remaining = MAX_FILES_PER_POST - attachments.length;
    if (remaining <= 0) {
      setError(`You're at the ${MAX_FILES_PER_POST}-attachment limit. Remove one first.`);
      return;
    }
    const accepted = list.slice(0, remaining);
    if (list.length > accepted.length) {
      setError(`Only added the first ${accepted.length} — you're near the ${MAX_FILES_PER_POST}-attachment cap.`);
    } else {
      setError(null);
    }

    setUploading(true);
    const newAttachments: Attachment[] = [];

    try {
      for (let i = 0; i < accepted.length; i++) {
        const file = accepted[i];
        const isVideo = VIDEO_TYPES.has(file.type);
        const fileLabel = `${file.name.slice(0, 20)}${file.name.length > 20 ? "…" : ""}`;

        if (isVideo) {
          // Large videos bypass the server action — upload directly to Vercel Blob.
          if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
            setError(`"${file.name}" is too large. Max ${MAX_VIDEO_MB} MB for videos.`);
            break;
          }
          setUploadProgress({ label: `Uploading ${fileLabel}`, pct: 0 });

          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const blob = await blobUpload(
            `community/${Date.now()}-${safeName}`,
            file,
            {
              access: "public",
              handleUploadUrl: "/api/upload-token",
              onUploadProgress: ({ percentage }) => {
                setUploadProgress({ label: `Uploading ${fileLabel}`, pct: percentage });
              },
            }
          );
          newAttachments.push({
            type: "video",
            url: blob.url,
            filename: file.name,
            size: file.size,
          });
        } else {
          // Images and PDFs go through the server action.
          if (file.size > MAX_IMAGE_BYTES) {
            setError(`"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 8 MB for images.`);
            break;
          }
          setUploadProgress({
            label: `Uploading file ${i + 1} of ${accepted.length}`,
            pct: Math.round((i / accepted.length) * 100),
          });
          const formData = new FormData();
          formData.append("files", file);
          const res = await uploadPostAttachments(formData);
          if (!res.ok) {
            setError(res.error ?? "Upload failed");
            break;
          }
          if (res.attachments) {
            newAttachments.push(...res.attachments);
          }
        }

        setUploadProgress({
          label: `Uploaded ${i + 1} of ${accepted.length}`,
          pct: Math.round(((i + 1) / accepted.length) * 100),
        });
      }

      setAttachments((prev) => [...prev, ...newAttachments]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  function submit() {
    if (!body.trim() && !attachments.length && !stagedGif) return;
    startTransition(async () => {
      const allAttachments: Attachment[] = [...attachments];
      if (stagedGif) allAttachments.push({ type: "gif", url: stagedGif, filename: "giphy.gif", size: 0 });
      await createPost({ body, category, attachments: allAttachments });
      setBody("");
      setAttachments([]);
      setStagedGif(null);
      setCategory("general");
      setExpanded(false);
    });
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (uploading) return;
    setIsDragging(true);
  }
  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }
  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (uploading) return;
    handleFiles(e.dataTransfer.files);
  }

  // ── Collapsed state ────────────────────────────────────────────────────────
  if (!expanded) {
    return (
      <div className="space-y-3">
        {showIntroPrompt && (
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/8 to-primary/4 p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none">👋</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  Welcome{memberFirstName ? `, ${memberFirstName}` : ""}! Say hi to the community.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Members who introduce themselves get way more support. Tell us who you are and why you joined — it takes 30 seconds.
                </p>
                <Button
                  type="button"
                  variant="gradient"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    const name = memberFirstName ?? "new here";
                    setBody(`Hi everyone! I'm ${name} 👋\n\n`);
                    setExpanded(true);
                    setTimeout(() => {
                      const el = textareaRef.current;
                      if (el) {
                        el.focus();
                        el.setSelectionRange(el.value.length, el.value.length);
                      }
                    }, 50);
                  }}
                >
                  Write my intro ✨
                </Button>
              </div>
            </div>
          </div>
        )}
        <Card className="p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <Avatar className="size-9 shrink-0">
              <AvatarImage src={user?.imageUrl} />
              <AvatarFallback className="text-sm">
                {(user?.firstName ?? "U").slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => {
                setExpanded(true);
                setTimeout(() => textareaRef.current?.focus(), 50);
              }}
              className="flex-1 rounded-full border bg-muted/40 px-4 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              Share a win, ask a question, post a photo or video…
            </button>
            <Button
              variant="gradient"
              size="sm"
              onClick={() => {
                setExpanded(true);
                setTimeout(() => textareaRef.current?.focus(), 50);
              }}
            >
              Post
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ── Expanded state ─────────────────────────────────────────────────────────
  return (
    <Card
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "relative p-4 shadow-sm transition-colors",
        isDragging && "ring-2 ring-primary ring-offset-2"
      )}
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-primary/5 backdrop-blur-sm">
          <Upload className="size-8 text-primary" />
          <p className="text-sm font-bold text-primary">Drop to upload</p>
        </div>
      )}

      <div className="flex items-start gap-3">
        <Avatar className="mt-1 size-9 shrink-0">
          <AvatarImage src={user?.imageUrl} />
          <AvatarFallback className="text-sm">
            {(user?.firstName ?? "U").slice(0, 1)}
          </AvatarFallback>
        </Avatar>
        <Textarea
          ref={textareaRef}
          placeholder="Share a win, ask a question, post a progress photo or video..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-[80px] resize-none border-0 p-0 text-base focus-visible:ring-0 md:text-sm"
          autoFocus
        />
      </div>

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {attachments.map((att, i) => (
            <div
              key={i}
              className="group relative aspect-square overflow-hidden rounded-xl border bg-muted"
            >
              {att.type === "image" ? (
                <img src={att.url} alt={att.filename} className="size-full object-cover" />
              ) : att.type === "video" ? (
                <div className="flex h-full flex-col items-center justify-center gap-1 bg-black/80 text-white p-2">
                  <Play className="size-7 opacity-80" />
                  <div className="line-clamp-2 text-[10px] text-center leading-tight">
                    {att.filename}
                  </div>
                  <div className="text-[10px] opacity-60">
                    {(att.size / 1024 / 1024).toFixed(1)} MB
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
                  <FileText className="size-8 text-primary" />
                  <div className="line-clamp-2 text-[10px] font-medium">{att.filename}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {(att.size / 1024).toFixed(0)} KB
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(i)}
                className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-100 transition-opacity hover:bg-black/80 sm:opacity-0 sm:group-hover:opacity-100"
                aria-label="Remove attachment"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Staged GIF preview */}
      {stagedGif && (
        <div className="mt-3 inline-flex relative overflow-hidden rounded-xl border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={stagedGif} alt="GIF" className="h-24 w-32 object-cover" />
          <button
            type="button"
            onClick={() => setStagedGif(null)}
            className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* Hidden file picker — accepts images, PDFs, and videos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.pdf,application/pdf,video/mp4,video/quicktime,video/mpeg,video/webm,video/3gpp,video/x-m4v"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {/* Upload progress */}
      {uploadProgress && (
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold flex items-center gap-1.5">
              <Loader2 className="size-3 animate-spin" />
              {uploadProgress.label}
            </span>
            <span className="text-muted-foreground">{Math.round(uploadProgress.pct)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${uploadProgress.pct}%` }}
            />
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
        <div className="relative flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={uploading || attachments.length >= MAX_FILES_PER_POST}
            onClick={() => fileInputRef.current?.click()}
            title={`Add photos, videos, or PDFs (${MAX_FILES_PER_POST - attachments.length} remaining)`}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Paperclip className="size-4" />
            )}
            <span className="hidden sm:inline">
              {uploading
                ? "Uploading…"
                : attachments.length === 0
                  ? "Photo / Video"
                  : `Add more (${attachments.length}/${MAX_FILES_PER_POST})`}
            </span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setGifPickerOpen((o) => !o)}
            className={cn(gifPickerOpen && "bg-muted text-foreground")}
          >
            <span className="text-xs font-bold">GIF</span>
          </Button>
          {gifPickerOpen && (
            <GifPicker
              onSelect={(url) => { setStagedGif(url); setGifPickerOpen(false); }}
              onClose={() => setGifPickerOpen(false)}
            />
          )}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-full border bg-background px-3 py-1.5 text-sm"
          >
            <option value="general">General</option>
            <option value="wins">Win 🎉</option>
            <option value="questions">Question</option>
            <option value="recipes">Recipe idea</option>
            <option value="transformation">Transformation</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setExpanded(false);
              setBody("");
              setAttachments([]);
              setCategory("general");
              setError(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={(!body.trim() && !attachments.length) || isPending || uploading}
            variant="gradient"
          >
            {isPending ? "Posting..." : "Post"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
