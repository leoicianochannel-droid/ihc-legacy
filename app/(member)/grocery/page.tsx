import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db, users, groceryLists, recipes } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Printer, Salad } from "lucide-react";

function weekStart(d = new Date()): string {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export default async function GroceryPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const [u] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!u) redirect("/onboarding");

  const ws = weekStart();
  const [list] = await db
    .select()
    .from(groceryLists)
    .where(and(eq(groceryLists.userId, u.id), eq(groceryLists.weekStartDate, ws)))
    .limit(1);

  const pickedRecipes = list?.recipeIds.length
    ? await db.select().from(recipes).where(inArray(recipes.id, list.recipeIds))
    : [];

  // Merge ingredients by item name.
  type Merged = { item: string; amounts: string[]; aisle?: string };
  const merged = new Map<string, Merged>();
  for (const r of pickedRecipes) {
    for (const ing of r.ingredients ?? []) {
      const key = ing.item.toLowerCase().trim();
      const prev = merged.get(key);
      if (prev) prev.amounts.push(ing.amount);
      else merged.set(key, { item: ing.item, amounts: [ing.amount], aisle: ing.aisle });
    }
  }

  const items = [...merged.values()].sort((a, b) =>
    (a.aisle ?? "zzz").localeCompare(b.aisle ?? "zzz")
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-10 md:py-8">
      <div className="mb-4">
        <h1 className="font-display text-4xl font-bold">Grocery List</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Week of {new Date(ws).toLocaleDateString("en-US", { month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Tab switcher */}
      <div className="mb-6 flex gap-2">
        <Link
          href="/recipes"
          className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          <Salad className="size-4" /> Recipes
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">
          <ShoppingCart className="size-4" /> Grocery List
        </span>
      </div>

      <div className="mb-6 flex justify-end">
        <Button variant="outline" size="sm"><Printer className="size-4" /> Print / Save</Button>
      </div>

      {pickedRecipes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="mx-auto size-12 text-muted-foreground" />
            <p className="mt-4 font-display text-xl font-bold">Your list is empty</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse recipes and tap "Add to this week" to auto-build your grocery list.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-6 p-6">
            <div className="text-sm font-semibold">Recipes for this week:</div>
            <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
              {pickedRecipes.map((r) => <li key={r.id}>{r.title}</li>)}
            </ul>
          </Card>

          <Card className="p-6">
            <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Grocery list ({items.length} items)
            </div>
            <ul className="mt-4 space-y-0">
              {items.map((it, i) => (
                <li key={i} className="flex items-center gap-3 border-b py-3 last:border-0">
                  <input
                    type="checkbox"
                    className="size-5 rounded border-border accent-[hsl(var(--primary))]"
                  />
                  <div className="flex-1">
                    <div className="font-semibold">{it.item}</div>
                    <div className="text-xs text-muted-foreground">{it.amounts.join(" + ")}</div>
                  </div>
                  {it.aisle && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {it.aisle}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
