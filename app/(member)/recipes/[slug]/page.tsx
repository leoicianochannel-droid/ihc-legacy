import { notFound } from "next/navigation";
import Link from "next/link";
import { db, recipes } from "@/lib/db";
import { eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Clock, Flame, Users as Servings } from "lucide-react";
import { AddToWeekButton } from "./add-to-week";
import { PrintButton } from "@/components/member/print-button";
import { SaveButton } from "./save-button";
import { getSavedRecipeIds } from "./actions";

export default async function RecipeDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [r] = await db.select().from(recipes).where(eq(recipes.slug, slug)).limit(1);
  if (!r) notFound();

  const savedIds = await getSavedRecipeIds();
  const isSaved = savedIds.includes(r.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-10 md:py-8" data-print-recipe>
      <div className="mb-4 flex items-center justify-between" data-print-hide>
        <Button asChild variant="ghost" size="sm">
          <Link href="/recipes"><ChevronLeft /> All recipes</Link>
        </Button>
        <PrintButton />
      </div>

      {r.photoUrl && (
        <div className="mb-6 overflow-hidden rounded-2xl">
          <img src={r.photoUrl} alt={r.title} className="aspect-[16/9] w-full object-cover" />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge className="capitalize">{r.mealType}</Badge>
        {r.dietaryTags.map((t) => (
          <Badge key={t} variant="secondary">{t}</Badge>
        ))}
      </div>
      <h1 className="font-display text-4xl font-bold">{r.title}</h1>
      {r.description && <p className="mt-2 text-foreground/80">{r.description}</p>}

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4 text-center">
          <Clock className="mx-auto size-5 text-primary" />
          <div className="mt-1 font-display text-xl font-bold">{r.timeMin ?? "—"}</div>
          <div className="text-xs text-muted-foreground">minutes</div>
        </Card>
        <Card className="p-4 text-center">
          <Flame className="mx-auto size-5 text-primary" />
          <div className="mt-1 font-display text-xl font-bold">{r.calories ?? "—"}</div>
          <div className="text-xs text-muted-foreground">calories</div>
        </Card>
        <Card className="p-4 text-center">
          <Servings className="mx-auto size-5 text-primary" />
          <div className="mt-1 font-display text-xl font-bold">{r.servings ?? 1}</div>
          <div className="text-xs text-muted-foreground">servings</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="mx-auto text-primary font-bold">P</div>
          <div className="mt-1 font-display text-xl font-bold">{r.proteinG ? Math.round(r.proteinG) : "—"}g</div>
          <div className="text-xs text-muted-foreground">protein</div>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap gap-3" data-print-hide>
        <AddToWeekButton recipeId={r.id} />
        <SaveButton recipeId={r.id} initialSaved={isSaved} />
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-[1fr_2fr]">
        <section>
          <h2 className="font-display text-2xl font-bold">Ingredients</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {(r.ingredients ?? []).map((i, idx) => (
              <li key={idx} className="flex justify-between gap-4 border-b py-2">
                <span>{i.item}</span>
                <span className="text-muted-foreground">{i.amount}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="font-display text-2xl font-bold">Steps</h2>
          <ol className="mt-4 space-y-3 text-sm">
            {(r.steps ?? []).map((s, idx) => (
              <li key={idx} className="flex gap-4">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {idx + 1}
                </span>
                <span className="leading-relaxed">{s}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
