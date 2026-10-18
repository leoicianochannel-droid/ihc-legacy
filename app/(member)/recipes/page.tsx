import Link from "next/link";
import { ChipRow } from "@/components/member/chip-row";
import { auth } from "@clerk/nextjs/server";
import { db, recipes, users } from "@/lib/db";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Salad, Search, Flame, Clock, ShoppingCart, Bookmark, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
type MealType = (typeof MEAL_TYPES)[number];

const TIME_BUCKETS: { value: string; label: string; max: number }[] = [
  { value: "15", label: "Under 15 min", max: 15 },
  { value: "30", label: "Under 30 min", max: 30 },
  { value: "60", label: "Under 60 min", max: 60 },
];

const DIETARY_OPTIONS = [
  "high-protein",
  "vegetarian",
  "gluten-free",
  "dairy-free",
  "low-carb",
] as const;
type Diet = (typeof DIETARY_OPTIONS)[number];

function buildHref(opts: {
  q?: string;
  meal?: string | null;
  time?: string | null;
  diet?: string | null;
}) {
  const sp = new URLSearchParams();
  if (opts.q) sp.set("q", opts.q);
  if (opts.meal) sp.set("meal", opts.meal);
  if (opts.time) sp.set("time", opts.time);
  if (opts.diet) sp.set("diet", opts.diet);
  const qs = sp.toString();
  return qs ? `/recipes?${qs}` : "/recipes";
}

async function getTrendingRecipeIds(): Promise<string[]> {
  try {
    const rows = await db.execute(sql`
      SELECT reference_id, COUNT(*) AS saves
      FROM activity_log
      WHERE type = 'recipe_saved'
        AND reference_id IS NOT NULL
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY reference_id
      ORDER BY saves DESC
      LIMIT 6
    `);
    return (rows as unknown as Array<{ reference_id: string }>).map((r) => r.reference_id);
  } catch { return []; }
}

async function getSavedRecipes(userId: string) {
  try {
    const rows = await db.execute(sql`
      SELECT recipe_id FROM saved_recipes WHERE user_id = ${userId}
    `);
    return (rows as unknown as Array<{ recipe_id: string }>).map((r) => r.recipe_id);
  } catch { return []; }
}

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; meal?: string; time?: string; diet?: string; tab?: string }>;
}) {
  const { userId: clerkId } = await auth();
  const sp = await searchParams;
  const activeTab = sp.tab === "saved" ? "saved" : "all";
  const q = (sp.q ?? "").trim();
  const activeMeal = MEAL_TYPES.includes(sp.meal as MealType) ? (sp.meal as MealType) : null;
  const activeTime = TIME_BUCKETS.find((b) => b.value === sp.time)?.value ?? null;
  const activeTimeMax = TIME_BUCKETS.find((b) => b.value === sp.time)?.max ?? null;
  const activeDiet = DIETARY_OPTIONS.includes(sp.diet as Diet) ? (sp.diet as Diet) : null;

  // Resolve member id for saved recipes
  let me: { id: string } | null = null;
  if (clerkId) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
    me = u ?? null;
  }

  // Trending + saved (parallel)
  const [trendingIds, savedRecipeIds] = await Promise.all([
    activeTab === "all" && !q && !activeMeal && !activeTime && !activeDiet
      ? getTrendingRecipeIds()
      : Promise.resolve([]),
    me ? getSavedRecipes(me.id) : Promise.resolve([]),
  ]);

  // My Saved tab — fetch saved recipes by id
  let savedList: typeof recipes.$inferSelect[] = [];
  if (activeTab === "saved" && savedRecipeIds.length > 0) {
    savedList = await db
      .select()
      .from(recipes)
      .where(sql`${recipes.id} = ANY(ARRAY[${sql.join(savedRecipeIds.map((id) => sql`${id}::uuid`), sql`, `)}])`);
  }

  // Trending recipes
  let trendingList: typeof recipes.$inferSelect[] = [];
  if (trendingIds.length > 0) {
    trendingList = await db
      .select()
      .from(recipes)
      .where(sql`${recipes.id} = ANY(ARRAY[${sql.join(trendingIds.map((id) => sql`${id}::uuid`), sql`, `)}])`);
    // Preserve trending order
    trendingList.sort((a, b) => trendingIds.indexOf(a.id) - trendingIds.indexOf(b.id));
  }

  // Build where clauses
  const filters: SQL[] = [];
  if (q) {
    const pattern = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
    filters.push(
      or(ilike(recipes.title, pattern), ilike(recipes.description, pattern))!
    );
  }
  if (activeMeal) filters.push(eq(recipes.mealType, activeMeal));
  if (activeTimeMax != null) {
    filters.push(sql`${recipes.timeMin} IS NOT NULL AND ${recipes.timeMin} <= ${activeTimeMax}`);
  }
  if (activeDiet) {
    // dietary_tags is text[]; use array contains
    filters.push(sql`${activeDiet} = ANY(${recipes.dietaryTags})`);
  }

  const whereClause = filters.length > 0 ? and(...filters) : undefined;

  const list = await db
    .select()
    .from(recipes)
    .where(whereClause)
    .orderBy(desc(recipes.publishedAt));

  const anyFilter = q || activeMeal || activeTime || activeDiet;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-10 md:py-8">
      <div className="mb-4">
        <h1 className="font-display text-4xl font-bold">Recipes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fat-loss friendly. High-protein. Made by humans, for humans.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="scroll-row scroll-row-bleed mb-6 gap-2 py-1">
        <Link
          href="/recipes"
          className={cn(
            "inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors",
            activeTab === "all"
              ? "bg-primary text-primary-foreground"
              : "border border-border text-foreground/70 hover:bg-muted hover:text-foreground"
          )}
        >
          <Salad className="size-4" /> All Recipes
        </Link>
        <Link
          href="/recipes?tab=saved"
          className={cn(
            "inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors",
            activeTab === "saved"
              ? "bg-primary text-primary-foreground"
              : "border border-border text-foreground/70 hover:bg-muted hover:text-foreground"
          )}
        >
          <Bookmark className="size-4" /> My Saved
          {savedRecipeIds.length > 0 && (
            <span className={cn(
              "ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
              activeTab === "saved" ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
            )}>
              {savedRecipeIds.length}
            </span>
          )}
        </Link>
        <Link
          href="/grocery"
          className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-4 text-sm font-semibold text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          <ShoppingCart className="size-4" /> Grocery List
        </Link>
      </div>

      {activeTab === "saved" ? (
        /* ── My Saved tab ── */
        <>
          {savedList.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bookmark className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-4 font-display text-xl font-bold">No saved recipes yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tap the Save button on any recipe to bookmark it here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {savedList.map((r) => <RecipeCard key={r.id} r={r} />)}
            </div>
          )}
        </>
      ) : (
        /* ── All Recipes tab ── */
        <>
          {trendingList.length > 0 && (
            <div className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-primary">Trending This Week</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {trendingList.map((r) => <RecipeCard key={r.id} r={r} />)}
              </div>
              <div className="my-6 border-t" />
            </div>
          )}

          {/* Search + filters */}
          <form method="get" className="mb-4 space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={q}
                placeholder="Search recipes by title or description…"
                className="pl-10"
              />
              {activeMeal && <input type="hidden" name="meal" value={activeMeal} />}
              {activeTime && <input type="hidden" name="time" value={activeTime} />}
              {activeDiet && <input type="hidden" name="diet" value={activeDiet} />}
            </div>
          </form>

          <FilterRow
            label="Meal"
            options={[
              { value: null, label: "All" },
              ...MEAL_TYPES.map((m) => ({ value: m, label: m.charAt(0).toUpperCase() + m.slice(1) })),
            ]}
            activeValue={activeMeal}
            toHref={(v) => buildHref({ q, meal: v, time: activeTime, diet: activeDiet })}
          />
          <FilterRow
            label="Time"
            options={[{ value: null, label: "Any" }, ...TIME_BUCKETS.map((b) => ({ value: b.value, label: b.label }))]}
            activeValue={activeTime}
            toHref={(v) => buildHref({ q, meal: activeMeal, time: v, diet: activeDiet })}
          />
          <FilterRow
            label="Dietary"
            options={[{ value: null, label: "Any" }, ...DIETARY_OPTIONS.map((d) => ({ value: d, label: d.replace("-", " ") }))]}
            activeValue={activeDiet}
            toHref={(v) => buildHref({ q, meal: activeMeal, time: activeTime, diet: v })}
          />

          <div className="mb-2 mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {list.length} recipe{list.length === 1 ? "" : "s"}
              {anyFilter ? " match your filters" : ""}
            </span>
            {anyFilter && (
              <Link href="/recipes" className="font-semibold text-primary hover:underline">Clear all</Link>
            )}
          </div>

          {list.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Salad className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-4 font-display text-xl font-bold">
                  {anyFilter ? "Nothing matches" : "No recipes yet"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {anyFilter ? "Try clearing a filter — or pick a different combination." : "Upload recipes from the admin panel at /admin/content."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((r) => <RecipeCard key={r.id} r={r} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RecipeCard({ r }: { r: { id: string; slug: string; photoUrl: string | null; mealType: string; title: string; timeMin: number | null; calories: number | null; proteinG: number | null; dietaryTags: string[] } }) {
  return (
    <Link
      href={`/recipes/${r.slug}`}
      className="group block overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {r.photoUrl ? (
          <img src={r.photoUrl} alt={r.title} className="size-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Salad className="size-12 text-muted-foreground" />
          </div>
        )}
        <Badge className="absolute left-3 top-3 bg-black/80 capitalize text-white">{r.mealType}</Badge>
      </div>
      <div className="p-4">
        <h3 className="font-display text-lg font-bold leading-tight">{r.title}</h3>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {r.timeMin && <span className="flex items-center gap-1"><Clock className="size-3" /> {r.timeMin} min</span>}
          {r.calories && <span className="flex items-center gap-1"><Flame className="size-3" /> {r.calories} cal</span>}
          {r.proteinG && <span>{Math.round(r.proteinG)}g protein</span>}
        </div>
        {r.dietaryTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {r.dietaryTags.slice(0, 3).map((t) => (
              <Badge key={t} variant="outline" className="text-[10px] capitalize">{t.replace("-", " ")}</Badge>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function FilterRow({
  label,
  options,
  activeValue,
  toHref,
}: {
  label: string;
  options: { value: string | null; label: string }[];
  activeValue: string | null;
  toHref: (v: string | null) => string;
}) {
  return (
    <ChipRow
      label={label}
      size="xs"
      className="mb-1"
      options={options.map((opt) => ({
        key: opt.value ?? "all",
        label: opt.label,
        href: toHref(opt.value),
        active: opt.value === activeValue,
      }))}
    />
  );
}
