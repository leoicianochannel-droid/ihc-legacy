"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, recipes } from "@/lib/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function assertAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("not authenticated");
  const [me] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (me?.role !== "admin") throw new Error("forbidden");
}

type RecipeData = {
  title: string;
  description: string | null;
  mealType: string;
  timeMin: number | null;
  servings: number;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  photoUrl: string | null;
  dietaryTags: string[];
  ingredients: Array<{ item: string; amount: string }>;
  steps: string[];
};

export async function updateRecipe(id: string, data: RecipeData) {
  try {
    await assertAdmin();
    await db.update(recipes).set(data).where(eq(recipes.id, id));
    revalidatePath("/admin/content");
    revalidatePath("/recipes");
    return { ok: true };
  } catch (err) {
    return { error: (err as Error).message };
  }
}
