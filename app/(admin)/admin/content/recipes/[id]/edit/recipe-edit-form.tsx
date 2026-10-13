"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, X, Loader2 } from "lucide-react";
import type { Recipe } from "@/lib/db/schema";
import { updateRecipe } from "./actions";

export function RecipeEditForm({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(recipe.title);
  const [description, setDescription] = useState(recipe.description ?? "");
  const [mealType, setMealType] = useState(recipe.mealType);
  const [timeMin, setTimeMin] = useState(recipe.timeMin?.toString() ?? "");
  const [servings, setServings] = useState(recipe.servings?.toString() ?? "1");
  const [calories, setCalories] = useState(recipe.calories?.toString() ?? "");
  const [proteinG, setProteinG] = useState(recipe.proteinG?.toString() ?? "");
  const [carbsG, setCarbsG] = useState(recipe.carbsG?.toString() ?? "");
  const [fatG, setFatG] = useState(recipe.fatG?.toString() ?? "");
  const [photoUrl, setPhotoUrl] = useState(recipe.photoUrl ?? "");
  const [dietaryTags, setDietaryTags] = useState<string[]>(recipe.dietaryTags);
  const [newTag, setNewTag] = useState("");
  const [ingredients, setIngredients] = useState<Array<{ item: string; amount: string }>>(
    (recipe.ingredients ?? []).map((i) => ({ item: i.item, amount: i.amount }))
  );
  const [steps, setSteps] = useState<string[]>(recipe.steps ?? []);

  function addTag() {
    const t = newTag.trim().toLowerCase();
    if (t && !dietaryTags.includes(t)) setDietaryTags((prev) => [...prev, t]);
    setNewTag("");
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, { item: "", amount: "" }]);
  }

  function updateIngredient(idx: number, field: "item" | "amount", val: string) {
    setIngredients((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));
  }

  function removeIngredient(idx: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
  }

  function addStep() {
    setSteps((prev) => [...prev, ""]);
  }

  function updateStep(idx: number, val: string) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? val : s)));
  }

  function removeStep(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  }

  function save() {
    startTransition(async () => {
      setError(null);
      const result = await updateRecipe(recipe.id, {
        title,
        description: description.trim() || null,
        mealType,
        timeMin: timeMin ? parseInt(timeMin) : null,
        servings: servings ? parseInt(servings) : 1,
        calories: calories ? parseInt(calories) : null,
        proteinG: proteinG ? parseFloat(proteinG) : null,
        carbsG: carbsG ? parseFloat(carbsG) : null,
        fatG: fatG ? parseFloat(fatG) : null,
        photoUrl: photoUrl.trim() || null,
        dietaryTags,
        ingredients: ingredients.filter((i) => i.item.trim()),
        steps: steps.filter((s) => s.trim()),
      });
      if (result?.error) {
        setError(result.error);
      } else {
        router.push("/admin/content");
      }
    });
  }

  const field = "flex flex-col gap-1.5";
  const sectionHead = "font-display text-lg font-bold mt-8 mb-3";

  return (
    <div className="space-y-4">
      {/* Basic info */}
      <div className={field}>
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className={field}>
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Short description shown on the recipe page"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className={field}>
          <Label>Meal type</Label>
          <select
            value={mealType}
            onChange={(e) => setMealType(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
        </div>
        <div className={field}>
          <Label>Time (min)</Label>
          <Input type="number" value={timeMin} onChange={(e) => setTimeMin(e.target.value)} />
        </div>
        <div className={field}>
          <Label>Servings</Label>
          <Input type="number" value={servings} onChange={(e) => setServings(e.target.value)} />
        </div>
        <div className={field}>
          <Label>Calories</Label>
          <Input type="number" value={calories} onChange={(e) => setCalories(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className={field}>
          <Label>Protein (g)</Label>
          <Input type="number" step="0.1" value={proteinG} onChange={(e) => setProteinG(e.target.value)} />
        </div>
        <div className={field}>
          <Label>Carbs (g)</Label>
          <Input type="number" step="0.1" value={carbsG} onChange={(e) => setCarbsG(e.target.value)} />
        </div>
        <div className={field}>
          <Label>Fat (g)</Label>
          <Input type="number" step="0.1" value={fatG} onChange={(e) => setFatG(e.target.value)} />
        </div>
      </div>

      <div className={field}>
        <Label>Photo URL</Label>
        <Input
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder="https://..."
        />
        {photoUrl && (
          <img src={photoUrl} alt="" className="mt-2 h-32 w-full rounded-xl object-cover" />
        )}
      </div>

      {/* Dietary tags */}
      <div>
        <p className={sectionHead}>Dietary tags</p>
        <div className="flex flex-wrap gap-2">
          {dietaryTags.map((t) => (
            <span
              key={t}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
            >
              {t}
              <button type="button" onClick={() => setDietaryTags((prev) => prev.filter((x) => x !== t))}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
            placeholder="e.g. gluten-free"
            className="max-w-48"
          />
          <Button type="button" variant="outline" size="sm" onClick={addTag}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </div>

      {/* Ingredients */}
      <div>
        <p className={sectionHead}>Ingredients</p>
        <div className="space-y-2">
          {ingredients.map((ing, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={ing.item}
                onChange={(e) => updateIngredient(idx, "item", e.target.value)}
                placeholder="Ingredient"
                className="flex-1"
              />
              <Input
                value={ing.amount}
                onChange={(e) => updateIngredient(idx, "amount", e.target.value)}
                placeholder="Amount"
                className="w-32"
              />
              <button
                type="button"
                onClick={() => removeIngredient(idx)}
                className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addIngredient}>
          <Plus className="size-4" /> Add ingredient
        </Button>
      </div>

      {/* Steps */}
      <div>
        <p className={sectionHead}>Steps</p>
        <div className="space-y-2">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="mt-2.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {idx + 1}
              </span>
              <Textarea
                value={step}
                onChange={(e) => updateStep(idx, e.target.value)}
                rows={2}
                className="flex-1 resize-none"
                placeholder={`Step ${idx + 1}`}
              />
              <button
                type="button"
                onClick={() => removeStep(idx)}
                className="mt-2 shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addStep}>
          <Plus className="size-4" /> Add step
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3 border-t pt-6">
        <Button onClick={save} disabled={isPending} variant="gradient">
          {isPending ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : "Save recipe"}
        </Button>
        <Button variant="ghost" onClick={() => router.push("/admin/content")} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
