"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, Circle, Sparkles, ArrowRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StartedTask } from "@/lib/getting-started";

export function GettingStartedCard({
  tasks,
  done,
  total,
  pct,
}: {
  tasks: StartedTask[];
  done: number;
  total: number;
  pct: number;
}) {
  const [expanded, setExpanded] = useState(done === 0);

  return (
    <Card className="relative overflow-hidden border-primary/30 bg-amber-50/40 ring-1 ring-primary/10">
      <div className="absolute inset-0 hoop-gradient opacity-20" aria-hidden />

      {/* Header row — always visible, click to expand/collapse */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="relative flex w-full items-center gap-4 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary">
            <Sparkles className="size-3" /> Getting Started
          </div>
          <p className="mt-0.5 text-sm text-foreground/80">
            {done === total
              ? "All done — you know the platform! 🎉"
              : `${done} of ${total} complete · ${total - done} step${total - done === 1 ? "" : "s"} left`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="font-display text-2xl font-bold leading-none text-primary">{pct}%</div>
          <div className="w-24">
            <Progress value={pct} className="h-2" />
          </div>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Task list — only shown when expanded */}
      {expanded && (
        <div className="relative border-t px-4 pb-4 pt-3">
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li key={task.id}>
                <Link
                  href={task.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5 transition-all hover:border-primary/40 hover:shadow-sm",
                    task.done && "opacity-60"
                  )}
                >
                  <div className="shrink-0">
                    {task.done ? (
                      <div className="flex size-6 items-center justify-center rounded-full bg-primary text-white">
                        <Check className="size-3.5" />
                      </div>
                    ) : (
                      <Circle className="size-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-sm font-semibold", task.done && "line-through")}>
                      {task.title}
                    </div>
                    {!task.done && (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {task.description}
                      </p>
                    )}
                  </div>
                  {!task.done && (
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
          {done === total - 1 && (
            <p className="mt-3 text-center text-sm font-semibold text-primary">
              One left! You're so close. ✨
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
