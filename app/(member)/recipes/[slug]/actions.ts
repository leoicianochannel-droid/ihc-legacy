"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, groceryLists } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/streak";

async function ensureSavedRecipesTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS saved_recipes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipe_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, recipe_id)
    )
  `);
}

export async function toggleSaveRecipe(recipeId: string): Promise<{ saved: boolean } | { error: string }> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { error: "not_authenticated" };
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!u) return { error: "no_user" };

  await ensureSavedRecipesTable();

  const existing = await db.execute(sql`
    SELECT id FROM saved_recipes WHERE user_id = ${u.id} AND recipe_id = ${recipeId} LIMIT 1
  `);
  const rows = existing as unknown as Array<{ id: string }>;

  if (rows.length > 0) {
    await db.execute(sql`DELETE FROM saved_recipes WHERE user_id = ${u.id} AND recipe_id = ${recipeId}`);
    revalidatePath("/recipes");
    return { saved: false };
  } else {
    await db.execute(sql`INSERT INTO saved_recipes (user_id, recipe_id) VALUES (${u.id}, ${recipeId}) ON CONFLICT DO NOTHING`);
    revalidatePath("/recipes");
    return { saved: true };
  }
}

export async function getSavedRecipeIds(): Promise<string[]> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return [];
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!u) return [];
  try {
    await ensureSavedRecipesTable();
    const rows = await db.execute(sql`SELECT recipe_id FROM saved_recipes WHERE user_id = ${u.id}`);
    return (rows as unknown as Array<{ recipe_id: string }>).map((r) => r.recipe_id);
  } catch { return []; }
}

/** Gets the current week's Monday in ISO date string. */
function weekStart(d = new Date()): string {
  const day = d.getDay();                        // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export async function addRecipeToWeek(recipeId: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { error: "not_authenticated" };

  const [u] = await db
    .select({ id: users.id, tz: users.timezone })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  if (!u) return { error: "no_user" };

  const ws = weekStart();
  const [existing] = await db
    .select()
    .from(groceryLists)
    .where(and(eq(groceryLists.userId, u.id), eq(groceryLists.weekStartDate, ws)))
    .limit(1);

  if (!existing) {
    await db.insert(groceryLists).values({
      userId: u.id,
      weekStartDate: ws,
      recipeIds: [recipeId],
    });
  } else if (!existing.recipeIds.includes(recipeId)) {
    await db
      .update(groceryLists)
      .set({
        recipeIds: [...existing.recipeIds, recipeId],
        updatedAt: new Date(),
      })
      .where(eq(groceryLists.id, existing.id));
  }

  await logActivity({
    userId: u.id,
    type: "recipe_saved",
    referenceId: recipeId,
    timezone: u.tz ?? undefined,
  });

  revalidatePath("/grocery");
  return { ok: true };
}
