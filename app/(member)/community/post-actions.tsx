"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
import { deletePost } from "./actions";

export function PostActions({
  postId,
  onEdit,
  onDeleted,
}: {
  postId: string;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  function handleDelete() {
    startTransition(async () => {
      const res = await deletePost(postId);
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        setConfirmDelete(false);
        return;
      }
      onDeleted();
    });
  }

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
        <span className="flex-1 font-semibold text-destructive">Delete this post?</span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="flex items-center gap-1 rounded-full bg-destructive px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
        >
          {isPending && <Loader2 className="size-3 animate-spin" />}
          Delete
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(false)}
          disabled={isPending}
          className="rounded-full border px-3 py-1 text-xs font-bold text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Post options"
        className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="size-4" />
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-xl border bg-background shadow-lg">
          <button
            type="button"
            onClick={() => { setMenuOpen(false); onEdit(); }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            <Pencil className="size-4 text-muted-foreground" /> Edit post
          </button>
          <button
            type="button"
            onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-4" /> Delete post
          </button>
        </div>
      )}
    </div>
  );
}
