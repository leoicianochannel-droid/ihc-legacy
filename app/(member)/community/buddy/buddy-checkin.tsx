"use client";

import { useState, useTransition, useRef } from "react";
import { Send, Loader2 } from "lucide-react";
import { sendMessage } from "@/app/(member)/messages/actions";

const PROMPTS = [
  "How's your week going? 💪",
  "Did you get your workout in today?",
  "Any wins to celebrate this week?",
  "How are you feeling about your goals?",
  "Let's go — we've got this! 🔥",
];

export function BuddyCheckin({
  conversationId,
  buddyFirstName,
}: {
  conversationId: string;
  buddyFirstName: string | null;
}) {
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function usePrompt(text: string) {
    setDraft(text);
    setSent(false);
    setError(null);
    setTimeout(() => textareaRef.current?.focus(), 30);
  }

  function submit() {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const res = await sendMessage(conversationId, body);
      if (res.ok) {
        setDraft("");
        setSent(true);
        setTimeout(() => setSent(false), 3000);
      } else {
        setError(res.error);
      }
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  }

  return (
    <div className="space-y-3">
      {/* Quick prompts */}
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Quick check-in prompts
      </p>
      <div className="flex flex-wrap gap-1.5">
        {PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => usePrompt(p)}
            className="rounded-full border bg-background px-2.5 py-1 text-xs font-semibold transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary active:scale-95"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setSent(false); }}
          onKeyDown={onKeyDown}
          placeholder={`Send ${buddyFirstName ?? "your buddy"} a message…`}
          rows={2}
          maxLength={1000}
          className="flex-1 resize-none rounded-2xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          onClick={submit}
          disabled={isPending || !draft.trim()}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </div>

      {sent && (
        <p className="text-xs font-semibold text-primary">
          Sent! {buddyFirstName ? `${buddyFirstName} will love that.` : "Keep it up! 🎉"}
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
