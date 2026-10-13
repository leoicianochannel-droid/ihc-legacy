"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, premiumWaitlist } from "@/lib/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function joinPremiumWaitlist(input: {
  email: string;
  features: string[];
  note: string;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("not authenticated");
  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) throw new Error("no user");

  await db.insert(premiumWaitlist).values({
    userId: me.id,
    email: input.email.trim().toLowerCase(),
    interestedFeatures: input.features,
    note: input.note?.trim() || null,
  });

  revalidatePath("/upgrade");
}
