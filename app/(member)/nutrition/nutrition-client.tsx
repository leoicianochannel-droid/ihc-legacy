"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { logFood, deleteFood, saveGoals } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus, Trash2, Search, X, Target, Loader2 } from "lucide-react";
import type { NutritionGoal, FoodLogEntry } from "@/lib/db/schema";
import type { FoodSearchResult } from "@/app/api/nutrition/search/route";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
const MEALS: { key: MealType; label: string; emoji: string }[] = [
  { key: "breakfast", label: "Breakfast", emoji: "🌅" },
  { key: "lunch", label: "Lunch", emoji: "☀️" },
  { key: "dinner", label: "Dinner", emoji: "🌙" },
  { key: "snack", label: "Snack", emoji: "🍎" },
];

function MacroRing({ value, goal, color, label, unit = "g" }: {
  value: number; goal: number; color: string; label: string; unit?: string;
}) {
  const pct = Math.min(100, goal > 0 ? (value / goal) * 100 : 0);
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-muted/30" />
        <circle
          cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 36 36)" style={{ transition: "stroke-dasharray 0.4s ease" }}
        />
        <text x="36" y="38" textAnchor="middle" className="text-[11px] font-bold" fill="currentColor" fontSize="11" fontWeight="bold">
          {value}{unit}
        </text>
      </svg>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-[10px] text-muted-foreground">/ {goal}{unit}</span>
    </div>
  );
}

function CalorieBar({ consumed, goal }: { consumed: number; goal: number }) {
  const remaining = goal - consumed;
  const pct = Math.min(100, goal > 0 ? (consumed / goal) * 100 : 0);
  const over = consumed > goal;
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <div>
          <span className="text-4xl font-bold">{consumed}</span>
          <span className="ml-1 text-muted-foreground text-sm">kcal</span>
        </div>
        <div className="text-right text-sm">
          <div className={over ? "font-semibold text-red-500" : "font-semibold text-primary"}>
            {over ? `${Math.abs(remaining)} over` : `${remaining} remaining`}
          </div>
          <div className="text-muted-foreground">Goal: {goal} kcal</div>
        </div>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-red-500" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-background border shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-base">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function AddFoodModal({
  open, onClose, date, mealType,
}: {
  open: boolean; onClose: () => void; date: string; mealType: MealType;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<FoodSearchResult | null>(null);
  const [grams, setGrams] = useState("100");
  const [manual, setManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualCal, setManualCal] = useState("");
  const [manualP, setManualP] = useState("");
  const [manualC, setManualC] = useState("");
  const [manualF, setManualF] = useState("");
  const [, startTransition] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const reset = useCallback(() => {
    setQuery(""); setResults([]); setSelected(null);
    setGrams("100"); setManual(false);
    setManualName(""); setManualCal(""); setManualP(""); setManualC(""); setManualF("");
  }, []);

  useEffect(() => { if (!open) reset(); }, [open, reset]);

  const search = (q: string) => {
    setQuery(q);
    clearTimeout(debounce.current);
    if (!q.trim()) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/nutrition/search?q=${encodeURIComponent(q)}`);
        const data = await r.json();
        setResults(data.results ?? []);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const g = parseFloat(grams) || 0;
  const calcNutrition = (per100: number) => Math.round((per100 * g) / 100 * 10) / 10;
  const mealLabel = MEALS.find(m => m.key === mealType)?.label ?? mealType;

  const handleAdd = () => {
    const fd = new FormData();
    fd.set("date", date);
    fd.set("mealType", mealType);
    if (manual) {
      fd.set("foodName", manualName);
      fd.set("calories", manualCal);
      fd.set("proteinG", manualP || "0");
      fd.set("carbsG", manualC || "0");
      fd.set("fatG", manualF || "0");
      fd.set("servingDesc", "custom");
    } else if (selected) {
      fd.set("foodName", selected.name);
      fd.set("calories", String(Math.round(calcNutrition(selected.per100g.calories))));
      fd.set("proteinG", String(calcNutrition(selected.per100g.proteinG)));
      fd.set("carbsG", String(calcNutrition(selected.per100g.carbsG)));
      fd.set("fatG", String(calcNutrition(selected.per100g.fatG)));
      fd.set("servingDesc", `${grams}g`);
    } else return;

    startTransition(async () => {
      await logFood(fd);
      onClose();
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={`Add food to ${mealLabel}`}>
      {!manual && !selected && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search food (e.g. chicken breast)"
              value={query}
              onChange={(e) => search(e.target.value)}
              className="pl-9"
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />}
          </div>
          {results.length > 0 && (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="w-full text-left rounded-lg border px-3 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <div className="font-medium text-sm leading-tight">{r.name}</div>
                  {r.brand && <div className="text-xs text-muted-foreground">{r.brand}</div>}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {r.per100g.calories} kcal · {r.per100g.proteinG}g protein · {r.per100g.carbsG}g carbs · {r.per100g.fatG}g fat (per 100g)
                  </div>
                </button>
              ))}
            </div>
          )}
          {query && !searching && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3">No results. Try manual entry below.</p>
          )}
          <button
            onClick={() => setManual(true)}
            className="w-full text-sm text-primary hover:underline text-center py-1"
          >
            + Enter manually
          </button>
        </div>
      )}

      {selected && !manual && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold">{selected.name}</div>
              {selected.brand && <div className="text-xs text-muted-foreground">{selected.brand}</div>}
            </div>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          <div>
            <Label>Amount (grams)</Label>
            <Input
              type="number"
              min="1"
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              className="mt-1 w-32"
            />
          </div>
          <div className="rounded-lg bg-muted/50 p-3 grid grid-cols-4 gap-2 text-center text-sm">
            <div><div className="font-bold">{Math.round(calcNutrition(selected.per100g.calories))}</div><div className="text-xs text-muted-foreground">kcal</div></div>
            <div><div className="font-bold">{calcNutrition(selected.per100g.proteinG)}g</div><div className="text-xs text-muted-foreground">protein</div></div>
            <div><div className="font-bold">{calcNutrition(selected.per100g.carbsG)}g</div><div className="text-xs text-muted-foreground">carbs</div></div>
            <div><div className="font-bold">{calcNutrition(selected.per100g.fatG)}g</div><div className="text-xs text-muted-foreground">fat</div></div>
          </div>
          <Button onClick={handleAdd} className="w-full">Add to {mealLabel}</Button>
        </div>
      )}

      {manual && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Manual entry</span>
            <button onClick={() => setManual(false)} className="text-xs text-muted-foreground hover:text-foreground">← Search instead</button>
          </div>
          <div>
            <Label>Food name *</Label>
            <Input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="e.g. Homemade soup" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Calories *</Label>
              <Input type="number" value={manualCal} onChange={(e) => setManualCal(e.target.value)} placeholder="e.g. 350" className="mt-1" />
            </div>
            <div>
              <Label>Protein (g)</Label>
              <Input type="number" value={manualP} onChange={(e) => setManualP(e.target.value)} placeholder="0" className="mt-1" />
            </div>
            <div>
              <Label>Carbs (g)</Label>
              <Input type="number" value={manualC} onChange={(e) => setManualC(e.target.value)} placeholder="0" className="mt-1" />
            </div>
            <div>
              <Label>Fat (g)</Label>
              <Input type="number" value={manualF} onChange={(e) => setManualF(e.target.value)} placeholder="0" className="mt-1" />
            </div>
          </div>
          <Button
            onClick={handleAdd}
            disabled={!manualName || !manualCal}
            className="w-full"
          >
            Add to {mealLabel}
          </Button>
        </div>
      )}
    </Modal>
  );
}

function GoalsModal({ open, onClose, goals }: { open: boolean; onClose: () => void; goals: NutritionGoal | null }) {
  const [, startTransition] = useTransition();
  return (
    <Modal open={open} onClose={onClose} title="Daily Nutrition Goals">
      <form
        action={(fd) => startTransition(async () => { await saveGoals(fd); onClose(); })}
        className="space-y-4"
      >
        {[
          { name: "calories", label: "Calories (kcal)", default: goals?.calories ?? 2000 },
          { name: "proteinG", label: "Protein (g)", default: goals?.proteinG ?? 150 },
          { name: "carbsG", label: "Carbs (g)", default: goals?.carbsG ?? 200 },
          { name: "fatG", label: "Fat (g)", default: goals?.fatG ?? 65 },
        ].map(({ name, label, default: def }) => (
          <div key={name}>
            <Label htmlFor={name}>{label}</Label>
            <Input id={name} name={name} type="number" min="0" defaultValue={def} className="mt-1" required />
          </div>
        ))}
        <Button type="submit" className="w-full">Save goals</Button>
      </form>
    </Modal>
  );
}

export function NutritionClient({
  date,
  entries,
  goals,
}: {
  date: string;
  entries: FoodLogEntry[];
  goals: NutritionGoal | null;
}) {
  const router = useRouter();
  const [addMeal, setAddMeal] = useState<MealType | null>(null);
  const [showGoals, setShowGoals] = useState(false);
  const [, startTransition] = useTransition();

  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + (e.proteinG ?? 0),
      carbs: acc.carbs + (e.carbsG ?? 0),
      fat: acc.fat + (e.fatG ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const g = goals ?? { calories: 2000, proteinG: 150, carbsG: 200, fatG: 65 };

  const navigate = (dir: -1 | 1) => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + dir);
    router.push(`/nutrition?date=${d.toISOString().slice(0, 10)}`);
  };

  const isToday = date === new Date().toISOString().slice(0, 10);
  const displayDate = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-6 md:py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Nutrition</h1>
          <p className="text-sm text-muted-foreground">{isToday ? "Today" : displayDate}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowGoals(true)}>
          <Target className="mr-1.5 size-4" /> Goals
        </Button>
      </div>

      {/* Date nav */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={() => navigate(-1)} className="rounded-full p-1.5 hover:bg-muted transition-colors">
          <ChevronLeft className="size-5" />
        </button>
        <span className="font-medium text-sm w-44 text-center">{displayDate}</span>
        <button
          onClick={() => navigate(1)}
          disabled={isToday}
          className="rounded-full p-1.5 hover:bg-muted transition-colors disabled:opacity-30"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {/* Summary card */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <CalorieBar consumed={Math.round(totals.calories)} goal={g.calories} />
          <div className="flex justify-around pt-2">
            <MacroRing value={Math.round(totals.protein)} goal={g.proteinG} color="#ec4899" label="Protein" />
            <MacroRing value={Math.round(totals.carbs)} goal={g.carbsG} color="#f59e0b" label="Carbs" />
            <MacroRing value={Math.round(totals.fat)} goal={g.fatG} color="#8b5cf6" label="Fat" />
          </div>
        </CardContent>
      </Card>

      {/* Meal sections */}
      {MEALS.map(({ key, label, emoji }) => {
        const mealEntries = entries.filter((e) => e.mealType === key);
        const mealCals = mealEntries.reduce((s, e) => s + e.calories, 0);
        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">{emoji}</span>
                <span className="font-semibold">{label}</span>
                {mealCals > 0 && (
                  <Badge variant="secondary" className="text-xs">{mealCals} kcal</Badge>
                )}
              </div>
              <Button size="sm" variant="ghost" onClick={() => setAddMeal(key)}>
                <Plus className="size-4 mr-1" /> Add
              </Button>
            </div>
            {mealEntries.length > 0 ? (
              <div className="space-y-1.5">
                {mealEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2.5 bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{entry.foodName}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.calories} kcal
                        {entry.proteinG ? ` · ${Math.round(entry.proteinG)}g protein` : ""}
                        {entry.carbsG ? ` · ${Math.round(entry.carbsG)}g carbs` : ""}
                        {entry.fatG ? ` · ${Math.round(entry.fatG)}g fat` : ""}
                        {entry.servingDesc ? ` · ${entry.servingDesc}` : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => startTransition(async () => { await deleteFood(entry.id); })}
                      className="ml-2 shrink-0 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="rounded-lg border border-dashed px-4 py-4 text-center text-sm text-muted-foreground cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setAddMeal(key)}
              >
                + Add {label.toLowerCase()}
              </div>
            )}
          </div>
        );
      })}

      <AddFoodModal
        open={addMeal !== null}
        onClose={() => setAddMeal(null)}
        date={date}
        mealType={addMeal ?? "snack"}
      />
      <GoalsModal open={showGoals} onClose={() => setShowGoals(false)} goals={goals} />
    </div>
  );
}
