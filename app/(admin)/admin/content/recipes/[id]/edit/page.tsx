import { notFound } from "next/navigation";
import { db, recipes } from "@/lib/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { RecipeEditForm } from "./recipe-edit-form";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
  if (!recipe) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-8">
      <Button asChild variant="ghost" size="sm" className="mb-6">
        <Link href="/admin/content">
          <ChevronLeft className="size-4" /> Back to content
        </Link>
      </Button>
      <h1 className="font-display text-2xl font-bold">Edit recipe</h1>
      <p className="mt-1 text-sm text-muted-foreground">{recipe.slug}</p>
      <div className="mt-6">
        <RecipeEditForm recipe={recipe} />
      </div>
    </div>
  );
}
