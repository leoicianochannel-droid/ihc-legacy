"use client";

import { useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addWorkoutComment, deleteWorkoutComment } from "./actions";

type Comment = {
  id: string;
  body: string;
  createdAt: Date;
  userId: string;
  authorName: string;
  authorAvatar: string | null;
};

function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return <img src={url} alt={name} className="size-8 rounded-full object-cover" />;
  }
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex size-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
      {initials}
    </div>
  );
}

export function WorkoutComments({
  workoutId,
  initialComments,
  currentUserId,
}: {
  workoutId: string;
  initialComments: Comment[];
  currentUserId: string | null;
}) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);

    const optimisticComment: Comment = {
      id: `optimistic-${Date.now()}`,
      body: body.trim(),
      createdAt: new Date(),
      userId: currentUserId ?? "",
      authorName: "You",
      authorAvatar: null,
    };

    setComments((prev) => [...prev, optimisticComment]);
    const submitted = body.trim();
    setBody("");

    startTransition(async () => {
      const res = await addWorkoutComment(workoutId, submitted);
      if (res && "error" in res) {
        setComments((prev) => prev.filter((c) => c.id !== optimisticComment.id));
        setError("Couldn't post comment. Try again.");
      }
    });
  }

  function handleDelete(commentId: string) {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    startTransition(async () => {
      await deleteWorkoutComment(commentId);
    });
  }

  return (
    <div className="mt-8">
      <h2 className="font-display text-xl font-bold">
        Comments{comments.length > 0 ? ` (${comments.length})` : ""}
      </h2>

      {comments.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Be the first to share your experience with this workout!
        </p>
      )}

      <div className="mt-4 space-y-4">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar name={c.authorName} url={c.authorAvatar} />
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold">{c.authorName}</span>
                <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
              </div>
              <p className="mt-0.5 text-sm leading-relaxed">{c.body}</p>
            </div>
            {currentUserId && c.userId === currentUserId && !c.id.startsWith("optimistic-") && (
              <button
                onClick={() => handleDelete(c.id)}
                className="ml-1 shrink-0 text-muted-foreground/50 hover:text-destructive"
                aria-label="Delete comment"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {currentUserId ? (
        <form onSubmit={handleSubmit} className="mt-5 flex gap-3">
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your experience…"
            rows={2}
            className="resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
          />
          <Button type="submit" variant="gradient" size="sm" disabled={!body.trim() || isPending} className="self-end">
            Post
          </Button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Sign in to leave a comment.</p>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
