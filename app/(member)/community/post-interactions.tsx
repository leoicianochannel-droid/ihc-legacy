"use client";

import {
  useState,
  useTransition,
  useRef,
  useEffect,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Image from "next/image";
import {
  Heart,
  MessageCircle,
  Loader2,
  Send,
  Reply,
  CornerDownRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  X,
  ImagePlus,
  Play,
  Link,
} from "lucide-react";
import { upload as blobUpload } from "@vercel/blob/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, formatDate, relativeTime } from "@/lib/utils";
import { GifPicker } from "@/components/community/gif-picker";
import {
  togglePostLike,
  toggleReaction,
  loadComments,
  addComment,
  editComment,
  deleteComment,
  searchMembers,
  uploadPostAttachments,
  type CommentRow,
  type CommentAttachment,
  type MemberSearchResult,
} from "./actions";

const REACTION_EMOJIS = ["🔥", "💪", "❤️", "😂"] as const;

const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/mpeg",
  "video/webm",
  "video/3gpp",
  "video/x-m4v",
]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_MB = 200;

// ── Attachment rendering inside a comment ─────────────────────────────────────
function CommentAttachments({ attachments }: { attachments: CommentAttachment[] }) {
  if (!attachments.length) return null;
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {attachments.map((att, i) =>
        att.type === "gif" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={att.url} alt="GIF" className="max-h-48 w-auto rounded-xl" />
        ) : att.type === "image" ? (
          <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="block">
            <Image
              src={att.url}
              alt={att.filename}
              width={320}
              height={240}
              className="max-h-60 w-auto rounded-xl object-cover"
              unoptimized
            />
          </a>
        ) : (
          <video
            key={i}
            src={att.url}
            controls
            playsInline
            preload="metadata"
            className="w-full rounded-xl bg-black"
            style={{ maxHeight: 280 }}
          />
        )
      )}
    </div>
  );
}

// ── Highlight @mentions and linkify URLs in comment body ─────────────────────
function CommentBody({ text }: { text: string }) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const segments = text.split(urlRegex);
  return (
    <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">
      {segments.map((seg, i) => {
        if (seg.match(/^https?:\/\//)) {
          return (
            <a key={i} href={seg} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
              {seg}
            </a>
          );
        }
        return seg.split(/(@\w+)/g).map((part, j) =>
          part.startsWith("@") ? (
            <span key={`${i}-${j}`} className="font-semibold text-primary">{part}</span>
          ) : (
            <span key={`${i}-${j}`}>{part}</span>
          )
        );
      })}
    </p>
  );
}

// ── Single comment bubble ─────────────────────────────────────────────────────
function CommentBubble({
  comment,
  currentUserId,
  onReply,
  onEdited,
  onDeleted,
  isReply = false,
}: {
  comment: CommentRow;
  currentUserId: string | null;
  onReply: (comment: CommentRow) => void;
  onEdited: (id: string, newBody: string) => void;
  onDeleted: (id: string) => void;
  isReply?: boolean;
}) {
  const isOwner = !!currentUserId && comment.authorId === currentUserId;
  const displayName = `${comment.authorFirstName ?? "Member"}${
    comment.authorLastName ? ` ${comment.authorLastName.slice(0, 1)}.` : ""
  }`;

  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(comment.body);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, startSave] = useTransition();
  const editRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  function startEdit() {
    setMenuOpen(false);
    setEditDraft(comment.body);
    setEditing(true);
    setTimeout(() => {
      editRef.current?.focus();
      const len = editRef.current?.value.length ?? 0;
      editRef.current?.setSelectionRange(len, len);
    }, 30);
  }

  function cancelEdit() {
    setEditing(false);
    setEditDraft(comment.body);
  }

  function saveEdit() {
    const trimmed = editDraft.trim();
    if (!trimmed || trimmed === comment.body) { cancelEdit(); return; }
    startSave(async () => {
      const res = await editComment(comment.id, trimmed);
      if (res.ok) { onEdited(comment.id, trimmed); setEditing(false); }
    });
  }

  function onEditKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
    if (e.key === "Escape") cancelEdit();
  }

  return (
    <div className={cn("flex items-start gap-2", isReply && "ml-9 mt-1.5")}>
      {isReply && <CornerDownRight className="size-3.5 mt-2 shrink-0 text-muted-foreground/40" />}
      <Avatar className="size-7 shrink-0">
        <AvatarImage src={comment.authorAvatarUrl ?? undefined} />
        <AvatarFallback className="text-[10px]">
          {(comment.authorFirstName ?? "U").slice(0, 1)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="rounded-2xl bg-muted px-3 py-2">
          <div className="flex items-baseline gap-2 text-xs">
            <span className="font-semibold">{displayName}</span>
            <span className="text-muted-foreground">
              {formatDate(comment.createdAt, { month: "short", day: "numeric", year: undefined })}
            </span>
            {isOwner && !editing && (
              <div ref={menuRef} className="relative ml-auto">
                <button
                  type="button"
                  onClick={() => { setMenuOpen((o) => !o); setConfirmDelete(false); }}
                  className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-6 z-50 w-36 overflow-hidden rounded-xl border bg-background shadow-lg">
                    <button
                      type="button"
                      onClick={startEdit}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-muted"
                    >
                      <Pencil className="size-3" /> Edit
                    </button>
                    {confirmDelete ? (
                      <button
                        type="button"
                        onClick={() => { setMenuOpen(false); onDeleted(comment.id); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3" /> Confirm delete
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3" /> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {editing ? (
            <div className="mt-1.5">
              <textarea
                ref={editRef}
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onKeyDown={onEditKeyDown}
                rows={2}
                maxLength={2000}
                className="w-full resize-none rounded-xl border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="mt-1 flex justify-end gap-2">
                <button type="button" onClick={cancelEdit} className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
                  <X className="size-3" /> Cancel
                </button>
                <button type="button" onClick={saveEdit} disabled={saving} className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:opacity-80 disabled:opacity-40">
                  {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Save
                </button>
              </div>
            </div>
          ) : (
            <>
              {comment.body && <CommentBody text={comment.body} />}
              <CommentAttachments attachments={comment.attachments} />
            </>
          )}
        </div>

        {!isReply && !editing && (
          <button
            type="button"
            onClick={() => onReply(comment)}
            className="mt-0.5 ml-2 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-primary"
          >
            <Reply className="size-3" /> Reply
          </button>
        )}
      </div>
    </div>
  );
}

// ── @mention dropdown ─────────────────────────────────────────────────────────
function MentionDropdown({
  results,
  highlight,
  onSelect,
}: {
  results: MemberSearchResult[];
  highlight: number;
  onSelect: (m: MemberSearchResult) => void;
}) {
  if (results.length === 0) return null;
  return (
    <div className="absolute bottom-full left-0 z-50 mb-1 w-56 overflow-hidden rounded-xl border bg-background shadow-lg">
      {results.map((m, i) => (
        <button
          key={m.id}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onSelect(m); }}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted",
            i === highlight && "bg-muted"
          )}
        >
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {(m.firstName ?? "U").slice(0, 1)}
          </div>
          <span className="font-semibold">{m.firstName ?? "Member"}</span>
          {m.lastName && <span className="text-muted-foreground">{m.lastName.slice(0, 1)}.</span>}
        </button>
      ))}
    </div>
  );
}

// ── Staged file preview (before submit) ──────────────────────────────────────
function StagedFile({
  file,
  objectUrl,
  onRemove,
}: {
  file: File;
  objectUrl: string;
  onRemove: () => void;
}) {
  const isVideo = VIDEO_TYPES.has(file.type);
  return (
    <div className="relative inline-flex overflow-hidden rounded-xl border bg-muted">
      {isVideo ? (
        <div className="flex h-20 w-28 items-center justify-center bg-black">
          <Play className="size-7 text-white/70" />
        </div>
      ) : (
        <Image src={objectUrl} alt={file.name} width={112} height={80} className="h-20 w-28 object-cover" unoptimized />
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
      >
        <X className="size-3" />
      </button>
      {isVideo && (
        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] text-white">
          {(file.size / 1024 / 1024).toFixed(0)} MB
        </span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function PostInteractions({
  postId,
  initialLiked,
  initialLikeCount,
  initialCommentCount,
  previewComments,
  currentUser,
  initialReactionCounts = {},
  initialMyReactions = [],
}: {
  postId: string;
  initialLiked: boolean;
  initialLikeCount: number;
  initialCommentCount: number;
  previewComments: CommentRow[];
  currentUser: { id: string | null; firstName: string | null; avatarUrl: string | null };
  initialReactionCounts?: Record<string, number>;
  initialMyReactions?: string[];
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [expandedComments, setExpandedComments] = useState<CommentRow[] | null>(null);
  const [loadingExpanded, setLoadingExpanded] = useState(false);
  const [optimisticAdds, setOptimisticAdds] = useState<CommentRow[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Staged files (not yet uploaded)
  const [stagedFiles, setStagedFiles] = useState<{ file: File; objectUrl: string }[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ label: string; pct: number } | null>(null);

  // Staged GIF (just a URL — no upload needed)
  const [stagedGif, setStagedGif] = useState<string | null>(null);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);

  // Emoji reactions
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>(initialReactionCounts);
  const [myReactions, setMyReactions] = useState<string[]>(initialMyReactions);
  const [copied, setCopied] = useState(false);

  function onReact(emoji: string) {
    if (!currentUser.id) return;
    // Optimistic update
    const already = myReactions.includes(emoji);
    setMyReactions((prev) => already ? prev.filter((e) => e !== emoji) : [...prev, emoji]);
    setReactionCounts((prev) => ({
      ...prev,
      [emoji]: Math.max(0, (prev[emoji] ?? 0) + (already ? -1 : 1)),
    }));
    startTransition(async () => {
      try {
        const res = await toggleReaction(postId, emoji);
        setReactionCounts(res.counts);
        setMyReactions(res.myReactions);
      } catch {
        // revert on error
        setMyReactions((prev) => already ? [...prev, emoji] : prev.filter((e) => e !== emoji));
        setReactionCounts((prev) => ({
          ...prev,
          [emoji]: Math.max(0, (prev[emoji] ?? 0) + (already ? 1 : -1)),
        }));
      }
    });
  }

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => stagedFiles.forEach((s) => URL.revokeObjectURL(s.objectUrl));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // @mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<MemberSearchResult[]>([]);
  const [mentionHighlight, setMentionHighlight] = useState(0);
  const mentionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Comment list ────────────────────────────────────────────────────────────
  const isExpanded = expandedComments !== null;
  const rawComments = isExpanded
    ? [...(expandedComments ?? []), ...optimisticAdds]
    : [...previewComments, ...optimisticAdds];
  const seenIds = new Set<string>();
  const allComments = rawComments.filter((c) => {
    if (seenIds.has(c.id)) return false;
    seenIds.add(c.id);
    return true;
  });

  const topLevel = allComments.filter((c) => !c.parentId);
  const repliesByParent = allComments.reduce<Record<string, CommentRow[]>>((acc, c) => {
    if (c.parentId) acc[c.parentId] = [...(acc[c.parentId] ?? []), c];
    return acc;
  }, {});

  const hiddenCount = Math.max(0, commentCount - previewComments.length);
  const mostRecentComment = [...optimisticAdds, ...previewComments][0] ?? null;
  const seen = new Set<string>();
  const commenterAvatars = [...optimisticAdds, ...previewComments]
    .filter((c) => {
      const key = c.authorFirstName ?? "?";
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);

  // ── File staging ────────────────────────────────────────────────────────────
  function stageFiles(files: FileList | File[] | null) {
    if (!files) return;
    const arr = Array.from(files);
    for (const file of arr) {
      const isVideo = VIDEO_TYPES.has(file.type);
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) {
        setSubmitError(`"${file.name}" is not a supported file type. Use a photo or video.`);
        return;
      }
      if (isImage && file.size > MAX_IMAGE_BYTES) {
        setSubmitError(`"${file.name}" is too large. Max 8 MB for images.`);
        return;
      }
      if (isVideo && file.size > MAX_VIDEO_MB * 1024 * 1024) {
        setSubmitError(`"${file.name}" is too large. Max ${MAX_VIDEO_MB} MB for videos.`);
        return;
      }
    }
    setSubmitError(null);
    setStagedFiles((prev) => [
      ...prev,
      ...arr.map((file) => ({ file, objectUrl: URL.createObjectURL(file) })),
    ]);
  }

  function removeStaged(i: number) {
    setStagedFiles((prev) => {
      URL.revokeObjectURL(prev[i].objectUrl);
      return prev.filter((_, j) => j !== i);
    });
  }

  // ── Edit/delete callbacks ───────────────────────────────────────────────────
  function handleEdited(id: string, newBody: string) {
    if (isExpanded) {
      setExpandedComments((prev) => (prev ?? []).map((c) => (c.id === id ? { ...c, body: newBody } : c)));
    }
    setOptimisticAdds((prev) => prev.map((c) => (c.id === id ? { ...c, body: newBody } : c)));
  }

  function handleDeleted(id: string) {
    startTransition(async () => {
      const res = await deleteComment(id, postId);
      if (!res.ok) return;
      if (isExpanded) setExpandedComments((prev) => (prev ?? []).filter((c) => c.id !== id));
      setOptimisticAdds((prev) => prev.filter((c) => c.id !== id));
      if (res.commentCount !== undefined) setCommentCount(res.commentCount);
    });
  }

  // ── Like ────────────────────────────────────────────────────────────────────
  function onLike() {
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevCount + (prevLiked ? -1 : 1));
    startTransition(async () => {
      try {
        const res = await togglePostLike(postId);
        setLiked(res.liked);
        setLikeCount(res.likeCount);
      } catch {
        setLiked(prevLiked);
        setLikeCount(prevCount);
      }
    });
  }

  // ── Expand comments ─────────────────────────────────────────────────────────
  async function onExpand() {
    if (isExpanded) return;
    setLoadingExpanded(true);
    try {
      const rows = await loadComments(postId);
      setExpandedComments(rows);
      setOptimisticAdds([]);
    } finally {
      setLoadingExpanded(false);
    }
  }

  // ── Reply shortcut ──────────────────────────────────────────────────────────
  function handleReply(comment: CommentRow) {
    setReplyTo(comment);
    const name = comment.authorFirstName ?? "Member";
    setDraft(`@${name} `);
    setTimeout(() => {
      inputRef.current?.focus();
      const len = inputRef.current?.value.length ?? 0;
      inputRef.current?.setSelectionRange(len, len);
    }, 50);
  }

  function cancelReply() {
    setReplyTo(null);
    setDraft("");
    setMentionQuery(null);
    setMentionResults([]);
  }

  // ── @mention detection ──────────────────────────────────────────────────────
  function detectMention(value: string, cursorPos: number) {
    const before = value.slice(0, cursorPos);
    const match = before.match(/@(\w*)$/);
    if (match) {
      const q = match[1];
      setMentionQuery(q);
      setMentionHighlight(0);
      if (mentionDebounce.current) clearTimeout(mentionDebounce.current);
      if (q.length >= 1) {
        mentionDebounce.current = setTimeout(async () => {
          const results = await searchMembers(q);
          setMentionResults(results);
        }, 200);
      } else {
        setMentionResults([]);
      }
    } else {
      setMentionQuery(null);
      setMentionResults([]);
    }
  }

  function onDraftChange(value: string) {
    setDraft(value);
    const cursor = inputRef.current?.selectionStart ?? value.length;
    detectMention(value, cursor);
  }

  function insertMention(member: MemberSearchResult) {
    const cursor = inputRef.current?.selectionStart ?? draft.length;
    const before = draft.slice(0, cursor).replace(/@\w*$/, `@${member.firstName} `);
    const after = draft.slice(cursor);
    const newDraft = before + after;
    setDraft(newDraft);
    setMentionQuery(null);
    setMentionResults([]);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(before.length, before.length);
    });
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  // gifOverride lets the GIF picker pass the URL directly (bypassing state timing)
  async function handleSubmit(gifOverride?: string) {
    const gif = gifOverride ?? stagedGif;
    const body = draft.trim();
    if (!body && stagedFiles.length === 0 && !gif) return;
    setSubmitError(null);

    // Upload files first
    const attachments: CommentAttachment[] = [];
    for (const { file } of stagedFiles) {
      const isVideo = VIDEO_TYPES.has(file.type);
      try {
        if (isVideo) {
          setUploadProgress({ label: file.name, pct: 0 });
          const blob = await blobUpload(
            `community-comments/${Date.now()}-${file.name}`,
            file,
            {
              access: "public",
              handleUploadUrl: "/api/upload-token",
              onUploadProgress: ({ percentage }) =>
                setUploadProgress({ label: file.name, pct: percentage }),
            }
          );
          attachments.push({ type: "video", url: blob.url, filename: file.name, size: file.size });
          setUploadProgress(null);
        } else {
          setUploadProgress({ label: file.name, pct: 50 });
          const fd = new FormData();
          fd.append("files", file);
          const res = await uploadPostAttachments(fd);
          setUploadProgress(null);
          if (!res.ok || !res.attachments) {
            setSubmitError(res.error ?? "Upload failed.");
            return;
          }
          attachments.push(...(res.attachments as CommentAttachment[]));
        }
      } catch {
        setUploadProgress(null);
        setSubmitError("Upload failed — please try again.");
        return;
      }
    }

    if (gif) {
      attachments.push({ type: "gif", url: gif, filename: "giphy.gif", size: 0 });
      if (gifOverride === undefined) setStagedGif(null);
    }

    setStagedFiles((prev) => { prev.forEach((s) => URL.revokeObjectURL(s.objectUrl)); return []; });
    setDraft("");
    const parentId = replyTo?.id ?? null;
    setReplyTo(null);
    setMentionQuery(null);
    setMentionResults([]);

    startTransition(async () => {
      const res = await addComment(postId, body, parentId, attachments);
      if (!res.ok) {
        setSubmitError(res.error);
        setDraft(body);
        return;
      }
      setCommentCount(res.commentCount);
      if (isExpanded) {
        setExpandedComments((prev) => [...(prev ?? []), res.comment]);
      } else {
        setOptimisticAdds((prev) => [...prev, res.comment]);
      }
    });
  }

  function onSubmitComment(e: FormEvent) {
    e.preventDefault();
    handleSubmit();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionResults.length > 0 && mentionQuery !== null) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionHighlight((i) => Math.min(i + 1, mentionResults.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionHighlight((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); const sel = mentionResults[mentionHighlight]; if (sel) insertMention(sel); return; }
      if (e.key === "Escape") { setMentionQuery(null); setMentionResults([]); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  }

  return (
    <div className="mt-3">
      {/* ── Emoji reactions ── */}
      <div className="flex items-center gap-1.5 border-t pt-3">
        {REACTION_EMOJIS.map((emoji) => {
          const count = reactionCounts[emoji] ?? 0;
          const active = myReactions.includes(emoji);
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(emoji)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition-all",
                active
                  ? "border-primary/40 bg-primary/10 font-semibold text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30 hover:bg-muted"
              )}
            >
              <span>{emoji}</span>
              {count > 0 && <span className="text-xs">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Action row ── */}
      <div className="flex items-center gap-4 pt-2.5">
        <button
          type="button"
          onClick={onLike}
          aria-pressed={liked}
          aria-label={liked ? "Unlike" : "Like"}
          className={cn("flex items-center gap-1.5 text-sm font-semibold transition-colors hover:text-primary", liked ? "text-primary" : "text-muted-foreground")}
        >
          <Heart className={cn("size-4", liked && "fill-current")} />
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>

        <button
          type="button"
          onClick={() => inputRef.current?.focus()}
          className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
        >
          <MessageCircle className="size-4" />
          {commentCount > 0 && <span>{commentCount}</span>}
        </button>

        {commenterAvatars.length > 0 && (
          <div className="flex flex-1 items-center gap-2 overflow-hidden">
            <div className="flex -space-x-2 shrink-0">
              {commenterAvatars.map((c, i) => (
                <Avatar key={i} className="size-6 ring-2 ring-background">
                  <AvatarImage src={c.authorAvatarUrl ?? undefined} />
                  <AvatarFallback className="text-[9px]">{(c.authorFirstName ?? "U").slice(0, 1)}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            {mostRecentComment?.createdAt && (
              <button type="button" onClick={onExpand} className="truncate text-xs font-semibold text-primary hover:underline">
                New comment {relativeTime(mostRecentComment.createdAt)}
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(window.location.origin + "/community/posts/" + postId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="ml-auto flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Copy link"
        >
          {copied ? <span className="text-xs font-semibold">Copied!</span> : <Link className="size-4" />}
        </button>
      </div>

      {/* "View all N comments" */}
      {!isExpanded && hiddenCount > 0 && (
        <button type="button" onClick={onExpand} disabled={loadingExpanded} className="mt-2 flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
          {loadingExpanded ? <><Loader2 className="size-3 animate-spin" /> Loading…</> : <>View all {commentCount} comments</>}
        </button>
      )}

      {/* Comment list */}
      {topLevel.length > 0 && (
        <ul className="mt-3 space-y-2">
          {topLevel.map((c) => (
            <li key={c.id}>
              <CommentBubble comment={c} currentUserId={currentUser.id} onReply={handleReply} onEdited={handleEdited} onDeleted={handleDeleted} />
              {(repliesByParent[c.id] ?? []).map((reply) => (
                <CommentBubble key={reply.id} comment={reply} currentUserId={currentUser.id} onReply={handleReply} onEdited={handleEdited} onDeleted={handleDeleted} isReply />
              ))}
            </li>
          ))}
        </ul>
      )}

      {/* Comment input */}
      <div className="mt-3">
        {replyTo && (
          <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Reply className="size-3 text-primary" />
            <span>Replying to <strong className="text-foreground">{replyTo.authorFirstName ?? "Member"}</strong></span>
            <button type="button" onClick={cancelReply} className="ml-auto text-[11px] font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        )}

        {/* Staged file previews */}
        {(stagedFiles.length > 0 || stagedGif) && (
          <div className="mb-2 flex flex-wrap gap-2">
            {stagedFiles.map((s, i) => (
              <StagedFile key={i} file={s.file} objectUrl={s.objectUrl} onRemove={() => removeStaged(i)} />
            ))}
            {stagedGif && (
              <div className="relative inline-flex overflow-hidden rounded-xl border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stagedGif} alt="GIF" className="h-20 w-28 object-cover" />
                <button
                  type="button"
                  onClick={() => setStagedGif(null)}
                  className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Upload progress bar */}
        {uploadProgress && (
          <div className="mb-2 rounded-xl border bg-muted/50 px-3 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="truncate text-muted-foreground">{uploadProgress.label}</span>
              <span className="ml-2 shrink-0 font-semibold">{Math.round(uploadProgress.pct)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${uploadProgress.pct}%` }} />
            </div>
          </div>
        )}

        <form onSubmit={onSubmitComment} className="flex items-end gap-2">
          <Avatar className="size-7 shrink-0">
            <AvatarImage src={currentUser.avatarUrl ?? undefined} />
            <AvatarFallback className="text-[10px]">{(currentUser.firstName ?? "U").slice(0, 1)}</AvatarFallback>
          </Avatar>

          <div ref={wrapperRef} className="relative flex-1">
            <MentionDropdown results={mentionResults} highlight={mentionHighlight} onSelect={insertMention} />
            {gifPickerOpen && (
              <GifPicker
                onSelect={(url) => { setGifPickerOpen(false); handleSubmit(url); }}
                onClose={() => setGifPickerOpen(false)}
              />
            )}
            <div className="flex items-end overflow-hidden rounded-2xl border bg-background focus-within:ring-2 focus-within:ring-primary/40">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={replyTo ? `Reply to ${replyTo.authorFirstName ?? "Member"}…` : "Write a comment…"}
                rows={1}
                maxLength={2000}
                className="flex-1 resize-none bg-transparent px-3 py-2 text-base outline-none md:text-sm"
              />
              {/* GIF button */}
              <button
                type="button"
                onClick={() => setGifPickerOpen((o) => !o)}
                className="shrink-0 px-1.5 py-2 text-xs font-bold text-muted-foreground transition-colors hover:text-primary"
                aria-label="Add GIF"
              >
                GIF
              </button>
              {/* Photo/video attach button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 p-2 text-muted-foreground transition-colors hover:text-primary"
                aria-label="Attach photo or video"
              >
                <ImagePlus className="size-4" />
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/mpeg,video/webm,video/3gpp,video/x-m4v"
            multiple
            className="hidden"
            onChange={(e) => { stageFiles(e.target.files); e.target.value = ""; }}
          />

          <button
            type="submit"
            disabled={isPending || !!uploadProgress || (!draft.trim() && stagedFiles.length === 0 && !stagedGif)}
            aria-label="Post comment"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          >
            {isPending || uploadProgress ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </form>
      </div>

      {submitError && <p className="mt-1 text-xs text-destructive">{submitError}</p>}
    </div>
  );
}
