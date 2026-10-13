"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, CheckCircle2, Sparkles, Loader2 } from "lucide-react";
import type { QuizAnswers } from "@/lib/plan-types";

// ── Question definitions ────────────────────────────────────────────────

const STEPS = [
  {
    id: 1,
    question: "What's your experience with hooping?",
    subtext: "Be honest — there's no wrong answer. We'll match you perfectly.",
    field: "experience" as const,
    options: [
      { value: "never", emoji: "🌱", label: "Brand new", sub: "Never tried it or just starting out" },
      { value: "some",  emoji: "🌀", label: "Some experience", sub: "I've hooped before but I'm not consistent" },
      { value: "regular", emoji: "⚡", label: "I already hoop", sub: "Regular hooper ready to level up" },
    ],
  },
  {
    id: 2,
    question: "What's your #1 goal for the next 2 months?",
    subtext: "This shapes every workout and recipe in your plan.",
    field: "goal" as const,
    options: [
      { value: "weight_loss",  emoji: "🔥", label: "Lose weight",        sub: "Burn fat and feel lighter" },
      { value: "toning",       emoji: "💪", label: "Tone up",            sub: "Build lean muscle and definition" },
      { value: "cardio",       emoji: "❤️", label: "Build my cardio",    sub: "More energy and endurance" },
      { value: "stress_relief",emoji: "✨", label: "Stress relief & fun",sub: "Move joyfully and feel good" },
    ],
  },
  {
    id: 3,
    question: "How many days a week can you realistically commit?",
    subtext: "Your plan will have exactly this many workouts per week.",
    field: "daysPerWeek" as const,
    options: [
      { value: 2, emoji: "🗓️", label: "2 days",   sub: "Light schedule, big impact" },
      { value: 3, emoji: "🗓️", label: "3 days",   sub: "The sweet spot for most people" },
      { value: 5, emoji: "🗓️", label: "5 days",   sub: "Committed and ready to go" },
    ],
  },
  {
    id: 4,
    question: "How long can each session be?",
    subtext: "Short sessions still work — we'll make every minute count.",
    field: "minutesPerSession" as const,
    options: [
      { value: 20, emoji: "⚡", label: "~20 minutes", sub: "Quick and effective" },
      { value: 30, emoji: "🎯", label: "~30 minutes", sub: "Great for most schedules" },
      { value: 45, emoji: "🏋️", label: "45+ minutes", sub: "Go deep, go long" },
    ],
  },
  {
    id: 5,
    question: "Any physical considerations we should know about?",
    subtext: "We'll avoid exercises that could aggravate existing issues.",
    field: "physicalNotes" as const,
    options: [
      { value: "none",       emoji: "✅", label: "Nothing, I'm good!",         sub: "No limitations" },
      { value: "back",       emoji: "🦴", label: "Lower back sensitivity",     sub: "We'll avoid high-impact core" },
      { value: "joints",     emoji: "🦵", label: "Joint sensitivity",          sub: "Knees, hips, or shoulders" },
      { value: "postpartum", emoji: "💗", label: "Recently postpartum",        sub: "Gentle rebuild mode" },
      { value: "injury",     emoji: "🩹", label: "Recovering from an injury",  sub: "Taking it easy" },
    ],
  },
  {
    id: 6,
    question: "Any nutrition focus?",
    subtext: "Your plan includes weekly recipes matched to your preference.",
    field: "dietaryPreference" as const,
    options: [
      { value: "none",         emoji: "🍽️", label: "No preference",    sub: "A little bit of everything" },
      { value: "weight_loss",  emoji: "🥗", label: "Weight loss",       sub: "Low calorie, high satiety" },
      { value: "high_protein", emoji: "🥩", label: "High protein",      sub: "Fuel muscle and recovery" },
      { value: "plant_based",  emoji: "🌿", label: "Plant-based",       sub: "Vegetarian or vegan" },
      { value: "gluten_free",  emoji: "🌾", label: "Gluten-free",       sub: "Avoiding gluten" },
    ],
  },
];

const TOTAL = STEPS.length;

// ── Component ────────────────────────────────────────────────────────────

export function QuizForm({ firstName }: { firstName: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0 = intro screen
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});

  const currentStep = STEPS[step - 1];
  const currentValue = currentStep ? answers[currentStep.field] : undefined;
  // Steps 5 & 6 (physical notes, dietary preference) are optional — they each
  // have a "None / No preference" option but shouldn't block progress.
  const OPTIONAL_FIELDS = new Set<string>(["physicalNotes", "dietaryPreference"]);
  const isOptionalStep = currentStep ? OPTIONAL_FIELDS.has(currentStep.field) : false;
  const canAdvance = step === 0 || currentValue !== undefined || isOptionalStep;

  function select(value: unknown) {
    if (!currentStep) return;
    setAnswers((prev) => ({ ...prev, [currentStep.field]: value }));
  }

  function next() {
    if (step < TOTAL) {
      setStep((s) => s + 1);
    } else {
      submit();
    }
  }

  function back() {
    if (step > 1) setStep((s) => s - 1);
    else setStep(0);
  }

  function submit() {
    setIsGenerating(true);
    setError(null);
    startTransition(async () => {
      try {
        // Default optional fields to "none" if the user skipped them
        const payload = {
          ...answers,
          physicalNotes: answers.physicalNotes ?? "none",
          dietaryPreference: answers.dietaryPreference ?? "none",
        };
        const res = await fetch("/api/member/generate-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Plan generation failed");
        router.push("/plan?new=1");
      } catch {
        setIsGenerating(false);
        setError("Something went wrong generating your plan. Please try again.");
      }
    });
  }

  // ── Generating screen ────────────────────────────────────────────────
  if (isGenerating) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-8 flex size-20 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="size-10 text-primary animate-pulse-soft" />
        </div>
        <h2 className="font-display text-3xl font-bold">Building your plan…</h2>
        <p className="mt-3 max-w-sm text-muted-foreground">
          Our AI is reading your answers and selecting workouts, recipes, and milestones tailored to you. This takes about 15 seconds.
        </p>
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>Personalising your 8-week journey…</span>
        </div>
      </div>
    );
  }

  // ── Intro screen (step 0) ─────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="size-10 text-primary" />
        </div>
        <h1 className="font-display text-4xl font-bold leading-tight md:text-5xl">
          Hey {firstName ?? "there"} 👋
        </h1>
        <p className="mt-4 max-w-md text-lg text-muted-foreground leading-relaxed">
          Let's build your personalised <strong>8-week hoop plan</strong> — workouts, recipes, and challenges chosen just for you.
        </p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Answer 6 quick questions and your plan will be ready in seconds.
        </p>
        <Button className="mt-8 gap-2 text-base" size="lg" onClick={() => setStep(1)}>
          Let's do it <ArrowRight className="size-5" />
        </Button>
      </div>
    );
  }

  // ── Question screen ───────────────────────────────────────────────────
  const progress = (step / TOTAL) * 100;

  return (
    <div className="flex min-h-[70vh] flex-col">
      {/* Progress bar */}
      <div className="h-1.5 w-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          {/* Step counter */}
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Question {step} of {TOTAL}
          </p>

          {/* Question */}
          <h2 className="font-display text-2xl font-bold leading-snug md:text-3xl">
            {currentStep.question}
          </h2>
          {currentStep.subtext && (
            <p className="mt-2 text-sm text-muted-foreground">{currentStep.subtext}</p>
          )}

          {/* Options */}
          <div className="mt-6 space-y-3">
            {currentStep.options.map((opt) => {
              const isSelected = currentValue === opt.value;
              return (
                <button
                  key={String(opt.value)}
                  onClick={() => select(opt.value)}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all hover:border-primary/50",
                    isSelected
                      ? "border-primary bg-primary/8 ring-2 ring-primary/20"
                      : "border-border bg-card"
                  )}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <div className="flex-1">
                    <div className="font-semibold">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.sub}</div>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="size-5 shrink-0 text-primary" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <p className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between gap-4">
            <Button variant="ghost" onClick={back} className="gap-2">
              <ArrowLeft className="size-4" /> Back
            </Button>
            <Button
              onClick={next}
              disabled={!canAdvance || isPending}
              className="gap-2"
              size="lg"
            >
              {step === TOTAL ? (
                <>Build my plan <Sparkles className="size-4" /></>
              ) : (
                <>Next <ArrowRight className="size-4" /></>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
