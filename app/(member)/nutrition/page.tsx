import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db, users, nutritionGoals, foodLog } from "@/lib/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { NutritionClient } from "./nutrition-client";

export const dynamic = "force-dynamic";

export default async function NutritionPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const [me] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) redirect("/onboarding");

  const { date: dateParam } = await searchParams;
  const date = dateParam ?? new Date().toISOString().slice(0, 10);

  const [goalsRow, entries, recentFoods] = await Promise.all([
    db.select().from(nutritionGoals).where(eq(nutritionGoals.userId, me.id)).limit(1).then((r) => r[0] ?? null),
    db.select().from(foodLog).where(and(eq(foodLog.userId, me.id), eq(foodLog.date, date))),
    // 10 most recently used distinct foods using DISTINCT ON (Postgres-specific)
    db.execute(sql`
      SELECT food_name AS "foodName", calories,
             protein_g AS "proteinG", carbs_g AS "carbsG", fat_g AS "fatG",
             serving_desc AS "servingDesc"
      FROM (
        SELECT DISTINCT ON (food_name)
          food_name, calories, protein_g, carbs_g, fat_g, serving_desc, created_at
        FROM food_log
        WHERE user_id = ${me.id}
        ORDER BY food_name, created_at DESC
      ) sub
      ORDER BY created_at DESC
      LIMIT 10
    `).then((r) => r as Array<{ foodName: string; calories: number; proteinG: number; carbsG: number; fatG: number; servingDesc: string | null }>),
  ]);

  return <NutritionClient date={date} entries={entries} goals={goalsRow} recentFoods={recentFoods} />;
}
