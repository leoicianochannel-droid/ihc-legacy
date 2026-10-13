"use client";

import { useEffect, useRef, useState, useTransition, FormEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendMessage, loadConversation, type MessageRow } from "../actions";

const POLL_INTERVAL_MS = 6000;

export function ConversationThread({
  conversationId,
  currentUserId,
  initialMessages,
}: {
  conversationId: string;
  currentUserId: string;
  initialMessages: MessageRow[];
}) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom when messages change
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Lightweight polling — refetch every few seconds while the tab is open
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const res = await loadConversation(conversationId);
        if (cancelled || !res.ok) return;
        // Only update if there's a length change to avoid pointless re-renders
        setMessages((prev) =>
          prev.length === res.messages.length ? prev : res.messages
        );
      } catch {}
    };
    const handle = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [conversationId]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setError(null);

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimistic: MessageRow = {
      id: tempId,
      body,
      senderId: currentUserId,
      createdAt: new Date(),
      readAt: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");

    startTransition(async () => {
      const res = await sendMessage(conversationId, body);
      if (!res.ok) {
        setError(res.error);
        // Roll back optimistic
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setDraft(body);
        return;
      }
      // Refresh to pick up the real persisted row
      const fresh = await loadConversation(conversationId);
      if (fresh.ok) setMessages(fresh.messages);
    });
  }

  return (
    <>
      <div
        ref={scrollerRef}
        className="flex-1 space-y-2 overflow-y-auto py-4"
      >
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Say hi 👋
          </p>
        )}
        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          return (
            <div
              key={m.id}
              className={cn("flex", mine ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                  mine
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                {m.body}
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={onSubmit}
        className="flex items-end gap-2 border-t pt-3"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          rows={1}
          maxLength={4000}
          className="flex-1 resize-none rounded-2xl border bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary/40 md:text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e as unknown as FormEvent);
            }
          }}
        />
        <button
          type="submit"
          disabled={isPending || !draft.trim()}
          aria-label="Send"
          className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </button>
      </form>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </>
  );
}
