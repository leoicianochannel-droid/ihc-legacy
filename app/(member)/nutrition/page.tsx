import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db, users, nutritionGoals, foodLog } from "@/lib/db";
import { eq, and } from "drizzle-orm";
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

  const [goalsRow, entries] = await Promise.all([
    db.select().from(nutritionGoals).where(eq(nutritionGoals.userId, me.id)).limit(1).then((r) => r[0] ?? null),
    db.select().from(foodLog).where(and(eq(foodLog.userId, me.id), eq(foodLog.date, date))),
  ]);

  return <NutritionClient date={date} entries={entries} goals={goalsRow} />;
}
