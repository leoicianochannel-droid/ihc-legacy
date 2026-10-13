"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Eye, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "queue" | "oldest_skool" | "newest_skool" | "explicit";

const MODE_LABELS: Record<Mode, { title: string; subtitle: string }> = {
  queue: {
    title: "Queue order",
    subtitle: "First-imported first. Default. Use for batches 2–4.",
  },
  oldest_skool: {
    title: "Loyalty: longest Skool members first",
    subtitle: "Reward super-fans with first access. Recommended for batch 1.",
  },
  newest_skool: {
    title: "Newest Skool members first",
    subtitle: "People who joined Skool most recently. Useful if you want to test fresh-relationship members.",
  },
  explicit: {
    title: "Specific email list",
    subtitle: "Paste exact addresses below. Use for the pilot batch (your own beta testers).",
  },
};

type PreviewRow = { email: string; firstName: string | null };

export function BatchSendForm({ pending }: { pending: number }) {
  const [mode, setMode] = useState<Mode>("queue");
  const [limit, setLimit] = useState(100);
  const [emailList, setEmailList] = useState("");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [result, setResult] = useState<{ sent: number; failures: number; remaining: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [stage, setStage] = useState<"idle" | "previewing" | "sending">("idle");

  function payload(extras: { dryRun?: boolean } = {}) {
    const base: Record<string, unknown> = { ...extras };
    if (mode === "explicit") {
      const emails = emailList
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@"));
      base.emails = emails;
    } else {
      base.cohort = mode;
      base.limit = limit;
    }
    return base;
  }

  async function doPreview() {
    setError(null);
    setResult(null);
    setStage("previewing");
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/migrate/send-invites", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload({ dryRun: true })),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "preview failed");
        setPreview(data.preview ?? []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setStage("idle");
      }
    });
  }

  async function doSend() {
    setError(null);
    if (!preview || preview.length === 0) {
      setError("Click Preview first so you can confirm who you're sending to.");
      return;
    }
    const ok = window.confirm(
      `Send invite emails to ${preview.length} members? They'll get a Clerk magic-link invitation and a branded welcome-back email.`
    );
    if (!ok) return;
    setStage("sending");
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/migrate/send-invites", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload()),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "send failed");
        setResult({
          sent: data.sent ?? 0,
          failures: (data.failures ?? []).length,
          remaining: data.remaining ?? 0,
        });
        setPreview(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setStage("idle");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Mode picker */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Cohort
        </label>
        {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setPreview(null);
              setResult(null);
            }}
            className={cn(
              "block w-full rounded-2xl border p-3 text-left text-sm transition-colors",
              mode === m
                ? "border-primary bg-primary/5"
                : "hover:bg-muted/50"
            )}
          >
            <div className="font-semibold">{MODE_LABELS[m].title}</div>
            <div className="text-xs text-muted-foreground">
              {MODE_LABELS[m].subtitle}
            </div>
          </button>
        ))}
      </div>

      {/* Size */}
      {mode !== "explicit" ? (
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Batch size (max 200)
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {[20, 50, 100, 200].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setLimit(n);
                  setPreview(null);
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  limit === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {pending.toLocaleString()} members pending invite total. After this
            send, ~{Math.max(0, pending - limit).toLocaleString()} would remain.
          </p>
        </div>
      ) : (
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Email addresses (one per line, comma or space separated)
          </label>
          <Textarea
            value={emailList}
            onChange={(e) => {
              setEmailList(e.target.value);
              setPreview(null);
            }}
            rows={5}
            placeholder="ashley@infinityhoop.com&#10;chris@infinityhoop.com&#10;tester1@example.com"
            className="mt-2 font-mono text-xs"
          />
        </div>
      )}

      {/* Preview block */}
      {preview && (
        <div className="rounded-2xl border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {preview.length} members will be invited
            </p>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear preview
            </button>
          </div>
          {preview.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Nobody matches — either everyone in this cohort has already been
              invited, or no email matched your list.
            </p>
          ) : (
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs">
              {preview.slice(0, 50).map((p, i) => (
                <li key={i} className="flex justify-between">
                  <span className="font-mono">{p.email}</span>
                  <span className="text-muted-foreground">{p.firstName ?? "—"}</span>
                </li>
              ))}
              {preview.length > 50 && (
                <li className="text-muted-foreground">
                  …and {preview.length - 50} more
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* Result block */}
      {result && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 className="size-5 shrink-0" />
          <div>
            <p className="font-semibold">
              Sent {result.sent}{" "}
              {result.failures > 0 ? `· ${result.failures} failed` : ""}
            </p>
            <p className="mt-0.5 text-xs">
              {result.remaining.toLocaleString()} members still pending invite.
              Wait 24h before the next batch — give Gmail/Outlook time to learn
              your domain is legit.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={doPreview}
          disabled={isPending || (mode === "explicit" && !emailList.trim())}
          className="flex-1"
        >
          {stage === "previewing" ? (
            <Loader2 className="mr-1 size-4 animate-spin" />
          ) : (
            <Eye className="mr-1 size-4" />
          )}
          Preview cohort
        </Button>
        <Button
          type="button"
          variant="gradient"
          onClick={doSend}
          disabled={isPending || !preview || preview.length === 0}
          className="flex-1"
        >
          {stage === "sending" ? (
            <Loader2 className="mr-1 size-4 animate-spin" />
          ) : (
            <Send className="mr-1 size-4" />
          )}
          Send invites
        </Button>
      </div>
    </div>
  );
}
