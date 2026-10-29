"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, nutritionGoals, foodLog } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function saveGoals(formData: FormData) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { error: "Not authenticated" };

  const [me] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return { error: "User not found" };

  const calories = parseInt(formData.get("calories") as string);
  const proteinG = parseInt(formData.get("proteinG") as string);
  const carbsG = parseInt(formData.get("carbsG") as string);
  const fatG = parseInt(formData.get("fatG") as string);

  if ([calories, proteinG, carbsG, fatG].some(isNaN)) return { error: "Invalid values" };

  await db
    .insert(nutritionGoals)
    .values({ userId: me.id, calories, proteinG, carbsG, fatG, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: nutritionGoals.userId,
      set: { calories, proteinG, carbsG, fatG, updatedAt: new Date() },
    });

  revalidatePath("/nutrition");
  return { success: true };
}

export async function logFood(formData: FormData) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { error: "Not authenticated" };

  const [me] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return { error: "User not found" };

  const date = formData.get("date") as string;
  const mealType = formData.get("mealType") as "breakfast" | "lunch" | "dinner" | "snack";
  const foodName = formData.get("foodName") as string;
  const calories = parseInt(formData.get("calories") as string);
  const proteinG = parseFloat(formData.get("proteinG") as string) || 0;
  const carbsG = parseFloat(formData.get("carbsG") as string) || 0;
  const fatG = parseFloat(formData.get("fatG") as string) || 0;
  const servingDesc = (formData.get("servingDesc") as string) || null;

  if (!date || !mealType || !foodName || isNaN(calories)) return { error: "Missing required fields" };

  await db.insert(foodLog).values({
    userId: me.id,
    date,
    mealType,
    foodName,
    calories,
    proteinG,
    carbsG,
    fatG,
    servingDesc,
  });

  revalidatePath("/nutrition");
  return { success: true };
}

export async function deleteFood(id: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { error: "Not authenticated" };

  const [me] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return { error: "User not found" };

  await db.delete(foodLog).where(and(eq(foodLog.id, id), eq(foodLog.userId, me.id)));

  revalidatePath("/nutrition");
  return { success: true };
}
