"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = {
  id: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
};

type Props = {
  userId: string;
  hasProfile: boolean;
  hasPosted: boolean;
  hasChallenge: boolean;
  hasBuddy: boolean;
};

export function OnboardingChecklist({ userId, hasProfile, hasPosted, hasChallenge, hasBuddy }: Props) {
  const storageKey = `onboarding-checklist-dismissed-${userId}`;
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(storageKey) === "1");
    } catch {}
  }, [storageKey]);

  const steps: Step[] = [
    {
      id: "profile",
      label: "Set up your profile",
      description: "Add a photo and bio so the community knows who you are.",
      href: `/profile/${userId}`,
      done: hasProfile,
    },
    {
      id: "post",
      label: "Make your first post",
      description: "Introduce yourself or share a win — anything goes!",
      href: "/community",
      done: hasPosted,
    },
    {
      id: "challenge",
      label: "Join a challenge",
      description: "Pick a challenge and start checking in every day.",
      href: "/challenges",
      done: hasChallenge,
    },
    {
      id: "buddy",
      label: "Find your accountability buddy",
      description: "Get matched with a hoop sister to keep each other on track.",
      href: "/community/buddy",
      done: hasBuddy,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  function dismiss() {
    try { localStorage.setItem(storageKey, "1"); } catch {}
    setDismissed(true);
  }

  // Don't render until mounted (avoids localStorage hydration mismatch)
  if (!mounted) return null;
  if (dismissed) return null;
  if (allDone) return null;

  return (
    <div className="mx-5 mb-4 rounded-2xl border border-primary/30 bg-primary/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex flex-1 items-center gap-2.5 text-left"
        >
          <span className="text-sm font-bold text-primary">
            Get started — {doneCount}/{steps.length} complete
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-primary/15 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
          {collapsed
            ? <ChevronDown className="size-4 text-primary shrink-0" />
            : <ChevronUp className="size-4 text-primary shrink-0" />
          }
        </button>
        <button
          onClick={dismiss}
          className="rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Steps */}
      {!collapsed && (
        <div className="border-t border-primary/15 divide-y divide-primary/10">
          {steps.map((step) => (
            <Link
              key={step.id}
              href={step.done ? "#" : step.href}
              onClick={step.done ? (e) => e.preventDefault() : undefined}
              className={cn(
                "flex items-start gap-3 px-4 py-3 transition-colors",
                step.done
                  ? "opacity-50 cursor-default"
                  : "hover:bg-primary/10 cursor-pointer"
              )}
            >
              {step.done
                ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                : <Circle className="mt-0.5 size-4 shrink-0 text-primary/40" />
              }
              <div className="min-w-0">
                <p className={cn("text-[13px] font-semibold", step.done && "line-through")}>
                  {step.label}
                </p>
                {!step.done && (
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                    {step.description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
