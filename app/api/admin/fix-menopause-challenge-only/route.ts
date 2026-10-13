import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users, workouts } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function POST() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const result = await db
    .update(workouts)
    .set({ challengeOnly: true })
    .where(eq(workouts.collection, "Menopause Reset"))
    .returning({ id: workouts.id, title: workouts.title });

  return NextResponse.json({ updated: result.length, workouts: result });
}
