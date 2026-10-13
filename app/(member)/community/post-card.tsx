"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pin, FileText, MessageCircle, Check, X, Loader2 } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import { PostInteractions } from "./post-interactions";
import { pinPost, unpinPost, editPost } from "./actions";
import { PostActions } from "./post-actions";
import { ImageLightbox } from "@/components/community/image-lightbox";
import type { CommentRow } from "./actions";

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function PostBody({ text }: { text: string }) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  const youtubeIds: string[] = [];

  const inlineSegments = parts.map((part, i) => {
    if (!part.match(/^https?:\/\//)) return part;
    const ytId = extractYouTubeId(part);
    if (ytId) {
      if (!youtubeIds.includes(ytId)) youtubeIds.push(ytId);
      return null;
    }
    return (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
        {part}
      </a>
    );
  });

  return (
    <>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
        {inlineSegments}
      </p>
      {youtubeIds.map((id) => (
        <div key={id} className="mt-3 overflow-hidden rounded-xl">
          <iframe
            src={`https://www.youtube.com/embed/${id}`}
            className="aspect-video w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ))}
    </>
  );
}

type Props = {
  post: {
    id: string;
    body: string;
    category: string;
    userId: string;
    likeCount: number;
    commentCount: number;
    pinnedAt: Date | null;
    createdAt: Date;
    photoUrls: string[];
    attachments: Array<{ type: "image" | "pdf" | "video" | "gif"; url: string; filename: string; size: number }> | null;
  };
  author: {
    id: string | null;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    tier: string | null;
  } | null;
  meId: string | null;
  meFirstName: string | null;
  meAvatarUrl: string | null;
  isAdmin?: boolean;
  initialLiked: boolean;
  previewComments: CommentRow[];
  initialReactionCounts?: Record<string, number>;
  initialMyReactions?: string[];
};

export function PostCard({
  post,
  author,
  meId,
  meFirstName,
  meAvatarUrl,
  isAdmin,
  initialLiked,
  previewComments,
  initialReactionCounts = {},
  initialMyReactions = [],
}: Props) {
  const [body, setBody] = useState(post.body);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [pinned, setPinned] = useState(!!post.pinnedAt);
  const [pinPending, startPinTransition] = useTransition();
  const isOwner = !!meId && meId === post.userId;

  // Inline post editing
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(body);
  const [editError, setEditError] = useState<string | null>(null);
  const [editPending, startEditTransition] = useTransition();
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      editRef.current?.focus();
      const len = editRef.current?.value.length ?? 0;
      editRef.current?.setSelectionRange(len, len);
    }
  }, [editing]);

  function startEdit() {
    setEditDraft(body);
    setEditError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditDraft(body);
    setEditError(null);
  }

  function saveEdit() {
    if (!editDraft.trim()) return;
    startEditTransition(async () => {
      const res = await editPost(post.id, editDraft);
      if (!res.ok) { setEditError(res.error ?? "Something went wrong."); return; }
      setBody(editDraft.trim());
      setEditing(false);
      setEditError(null);
    });
  }

  function onEditKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveEdit(); }
    if (e.key === "Escape") cancelEdit();
  }

  function togglePin() {
    startPinTransition(async () => {
      if (pinned) {
        await unpinPost(post.id);
        setPinned(false);
      } else {
        await pinPost(post.id);
        setPinned(true);
      }
    });
  }

  if (deleted) return null;

  const atts = (post.attachments ?? []) as Array<{ type: "image" | "pdf" | "video" | "gif"; url: string; filename: string; size: number }>;
  const images = atts.filter((a) => a.type === "image");
  const videos = atts.filter((a) => a.type === "video");
  const pdfs = atts.filter((a) => a.type === "pdf");
  const gifs = atts.filter((a) => a.type === "gif");

  return (
    <Card
      className={cn(
        "overflow-hidden shadow-sm transition-shadow hover:shadow-md",
        post.pinnedAt && "border-primary/40 ring-2 ring-primary/15"
      )}
    >
      <CardContent className="p-4 md:p-5">
        {/* Author row */}
        <div className="flex items-start gap-3">
          <Avatar className="size-10 shrink-0">
            <AvatarImage src={author?.avatarUrl ?? undefined} />
            <AvatarFallback>{(author?.firstName ?? "U").slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <Link
                href={author?.id ? `/profile/${author.id}` : "#"}
                className="font-bold leading-tight hover:underline"
              >
                {author?.firstName ?? "Member"}{" "}
                {(author?.lastName ?? "").slice(0, 1)}
                {author?.lastName ? "." : ""}
              </Link>
              {author?.tier && author.tier !== "starter" && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  {author.tier === "mover" && "💫"}
                  {author.tier === "champion" && "🔥"}
                  {author.tier === "legend" && "👑"}
                  {author.tier}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{formatDate(post.createdAt, { month: "short", day: "numeric", year: undefined })}</span>
              <span>·</span>
              <span className="capitalize">{post.category}</span>
              {meId && author?.id && author.id !== meId && (
                <>
                  <span>·</span>
                  <a
                    href={`/messages/start?userId=${author.id}`}
                    className="inline-flex items-center gap-0.5 font-semibold text-primary hover:underline"
                  >
                    <MessageCircle className="size-3" /> Message
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Pinned badge / admin toggle */}
          {isAdmin ? (
            <button
              onClick={togglePin}
              disabled={pinPending}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                pinned
                  ? "bg-primary/10 text-primary hover:bg-primary/20"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <Pin className="size-3" /> {pinned ? "Pinned" : "Pin"}
            </button>
          ) : pinned ? (
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
              <Pin className="size-3" /> Pinned
            </div>
          ) : null}

          {/* Edit/delete menu — only for post owner */}
          {isOwner && !editing && (
            <PostActions
              postId={post.id}
              onEdit={startEdit}
              onDeleted={() => setDeleted(true)}
            />
          )}
        </div>

        {/* Body */}
        {editing ? (
          <div className="mt-3">
            <textarea
              ref={editRef}
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={4}
              maxLength={4000}
              className="w-full resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            {editError && <p className="mt-1 text-xs text-destructive">{editError}</p>}
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={saveEdit}
                disabled={editPending || !editDraft.trim()}
                className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                {editPending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                Save
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={editPending}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                <X className="size-3" /> Cancel
              </button>
              <span className="ml-auto text-[11px] text-muted-foreground">⌘↵ to save</span>
            </div>
          </div>
        ) : (
          <PostBody text={body} />
        )}

        {/* Attachments */}
        {images.length > 0 && (
          <>
            <div className={`mt-3 grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {images.map((att, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="block overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={att.url}
                    alt={att.filename}
                    className={`w-full rounded-xl object-cover transition-opacity hover:opacity-90 ${images.length === 1 ? "max-h-[500px]" : "aspect-square"}`}
                  />
                </button>
              ))}
            </div>
            {lightboxIndex !== null && (
              <ImageLightbox
                images={images.map((a) => ({ url: a.url, alt: a.filename }))}
                index={lightboxIndex}
                onClose={() => setLightboxIndex(null)}
                onNavigate={setLightboxIndex}
              />
            )}
          </>
        )}
        {videos.length > 0 && (
          <div className="mt-3 space-y-3">
            {videos.map((att, i) => (
              <video
                key={i}
                src={att.url}
                controls
                playsInline
                preload="metadata"
                className="w-full rounded-xl bg-black max-h-[500px]"
              />
            ))}
          </div>
        )}
        {pdfs.length > 0 && (
          <div className="mt-3 space-y-2">
            {pdfs.map((att, i) => (
              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border bg-background p-3 transition-colors hover:bg-muted/50">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{att.filename}</div>
                  <div className="text-xs text-muted-foreground">PDF · {(att.size / 1024).toFixed(0)} KB</div>
                </div>
                <span className="text-xs font-semibold text-primary">Open</span>
              </a>
            ))}
          </div>
        )}
        {gifs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {gifs.map((att, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img key={i} src={att.url} alt="GIF" className="max-h-48 w-auto rounded-xl" />
            ))}
          </div>
        )}
        {atts.length === 0 && post.photoUrls.length > 0 && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {post.photoUrls.slice(0, 4).map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="block overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} className="aspect-square w-full rounded-xl object-cover transition-opacity hover:opacity-90" alt="" />
                </button>
              ))}
            </div>
            {lightboxIndex !== null && (
              <ImageLightbox
                images={post.photoUrls.slice(0, 4).map((url) => ({ url }))}
                index={lightboxIndex}
                onClose={() => setLightboxIndex(null)}
                onNavigate={setLightboxIndex}
              />
            )}
          </>
        )}

        <PostInteractions
          postId={post.id}
          initialLiked={initialLiked}
          initialLikeCount={post.likeCount}
          initialCommentCount={post.commentCount}
          previewComments={previewComments}
          currentUser={{ id: meId, firstName: meFirstName, avatarUrl: meAvatarUrl }}
          initialReactionCounts={initialReactionCounts}
          initialMyReactions={initialMyReactions}
        />
      </CardContent>
    </Card>
  );
}
