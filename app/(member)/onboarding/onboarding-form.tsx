"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Check, CheckCircle2 } from "lucide-react";
import { AvatarUploader } from "@/components/member/avatar-uploader";
import { saveOnboarding } from "./actions";

const STEPS = [
  { id: 1, title: "Add your profile photo" },
  { id: 2, title: "First, your goal" },
  { id: 3, title: "How you like to move" },
  { id: 4, title: "Your ideal accountability buddy" },
  { id: 5, title: "What else are you paying for?" },
];

const OTHER_MEMBERSHIPS = [
  { value: "peloton",      emoji: "🚴", label: "Peloton" },
  { value: "gym",          emoji: "🏋️", label: "Gym membership" },
  { value: "orangetheory", emoji: "🔥", label: "OrangeTheory" },
  { value: "classpass",    emoji: "📅", label: "ClassPass" },
  { value: "beachbody",    emoji: "🌊", label: "Beachbody / BODi" },
  { value: "noom",         emoji: "🥦", label: "Noom / Weight loss app" },
  { value: "youtube",      emoji: "▶️", label: "Free YouTube workouts" },
  { value: "other_app",    emoji: "📱", label: "Another fitness app" },
  { value: "none",         emoji: "✅", label: "Just Infinity Hoop!" },
];

export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();

  const [goal, setGoal] = useState("");
  const [fitnessLevel, setFitnessLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [age, setAge] = useState("");
  const [workoutPreferences, setWorkoutPreferences] = useState("");
  const [movementTiming, setMovementTiming] = useState("");
  const [idealBuddyWords, setIdealBuddyWords] = useState("");
  const [checkInStyle, setCheckInStyle] = useState<"fun" | "soft" | "accountability">("fun");
  const [selectedMemberships, setSelectedMemberships] = useState<string[]>([]);
  const [membershipsReason, setMembershipsReason] = useState("");
  const [referralCode, setReferralCode] = useState<string | undefined>(undefined);

  // Pick up referral code stashed by /sign-up ?ref=CODE
  useEffect(() => {
    try {
      const code = localStorage.getItem("ih_ref_code");
      if (code) {
        setReferralCode(code);
        // consume — only apply once
        localStorage.removeItem("ih_ref_code");
      }
    } catch {}
  }, []);

  const hasOtherMemberships =
    selectedMemberships.length > 0 &&
    !selectedMemberships.includes("none") &&
    !selectedMemberships.includes("youtube");

  const canNext =
    step === 1 || // photo step — always skippable
    (step === 2 && goal && fitnessLevel) ||
    (step === 3 && age && workoutPreferences) ||
    (step === 4 && idealBuddyWords) ||
    step === 5; // optional step — always allow submit

  function toggleMembership(value: string) {
    setSelectedMemberships((prev) => {
      if (value === "none") return ["none"];
      const withoutNone = prev.filter((v) => v !== "none");
      return withoutNone.includes(value)
        ? withoutNone.filter((v) => v !== value)
        : [...withoutNone, value];
    });
  }

  function handleSubmit() {
    startTransition(async () => {
      await saveOnboarding({
        goal,
        fitnessLevel,
        age: parseInt(age, 10),
        workoutPreferences,
        movementTiming,
        idealBuddyWords,
        checkInStyle,
        otherMemberships: selectedMemberships.length > 0 ? selectedMemberships.join(",") : undefined,
        otherMembershipsReason: membershipsReason.trim() || undefined,
        referralCode,
      });
      router.push("/plan-setup");
    });
  }

  return (
    <div className="mt-8">
      <Progress value={(step / STEPS.length) * 100} />
      <div className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
        Step {step} of {STEPS.length} — {STEPS[step - 1].title}
      </div>

      <Card className="mt-6 p-6 md:p-8">
        {step === 1 && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <AvatarUploader size="lg" name="You" />
            <div>
              <p className="font-semibold">Tap to add a photo</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Members with a photo get 3× more accountability buddy matches.
                You can always add one later in Settings.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <Label htmlFor="goal">What's your #1 goal right now?</Label>
              <Input
                id="goal"
                className="mt-2"
                placeholder="e.g. Lose 20 lbs by summer, feel strong and energetic, fit into my jeans"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </div>
            <div>
              <Label>Where are you starting from?</Label>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(["beginner", "intermediate", "advanced"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setFitnessLevel(l)}
                    className={`rounded-xl border-2 p-4 text-sm font-semibold capitalize transition-all ${
                      fitnessLevel === l
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <Label htmlFor="age">How old are you?</Label>
              <Input
                id="age"
                type="number"
                className="mt-2"
                placeholder="e.g. 38"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="prefs">
                What kinds of workouts do you actually love?
              </Label>
              <Textarea
                id="prefs"
                className="mt-2"
                placeholder="e.g. Dance cardio, walks on lunch break, strength training"
                value={workoutPreferences}
                onChange={(e) => setWorkoutPreferences(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="timing">When do you usually move?</Label>
              <Input
                id="timing"
                className="mt-2"
                placeholder="e.g. Mornings before work, evenings after kids are down"
                value={movementTiming}
                onChange={(e) => setMovementTiming(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div>
              <Label htmlFor="buddy">Describe your ideal buddy in 3 words</Label>
              <Input
                id="buddy"
                className="mt-2"
                placeholder='e.g. "Fun, focused, encouraging"'
                value={idealBuddyWords}
                onChange={(e) => setIdealBuddyWords(e.target.value)}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                We'll use this to match you with a member whose vibe fits yours.
              </p>
            </div>
            <div>
              <Label>Preferred check-in style</Label>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                {[
                  { id: "fun", label: "Fun & chatty", desc: "Cheerleader energy, daily memes" },
                  { id: "soft", label: "Soft & supportive", desc: "Kind check-ins, no pressure" },
                  { id: "accountability", label: "Tough love", desc: "Call me out, keep me honest" },
                ].map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setCheckInStyle(o.id as typeof checkInStyle)}
                    className={`rounded-xl border-2 p-4 text-left transition-all ${
                      checkInStyle === o.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className="text-sm font-bold">{o.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{o.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold text-foreground">Select everything that applies</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {OTHER_MEMBERSHIPS.map((item) => {
                  const selected = selectedMemberships.includes(item.value);
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => toggleMembership(item.value)}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 p-3 text-center text-xs font-semibold transition-all ${
                        selected
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <span className="text-2xl">{item.emoji}</span>
                      <span className="leading-tight">{item.label}</span>
                      {selected && <CheckCircle2 className="size-3.5 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {hasOtherMemberships && (
              <div>
                <Label htmlFor="why">What keeps you paying for those? <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  id="why"
                  className="mt-2"
                  placeholder="e.g. I like the community on Peloton, it holds me accountable. Or I go to the gym for weights but no one teaches me cardio…"
                  value={membershipsReason}
                  onChange={(e) => setMembershipsReason(e.target.value)}
                  rows={3}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">This helps us understand what keeps you motivated.</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex justify-between">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <div />
          )}
          {step < STEPS.length ? (
            <Button
              variant="gradient"
              onClick={() => setStep(step + 1)}
              disabled={!canNext}
            >
              Continue <ArrowRight />
            </Button>
          ) : (
            <Button
              variant="gradient"
              onClick={handleSubmit}
              disabled={!canNext || isPending}
            >
              {isPending ? "Setting up..." : "Let's go"} <Check />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
