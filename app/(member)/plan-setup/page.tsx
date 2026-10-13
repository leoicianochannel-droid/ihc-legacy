import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { QuizForm } from "./quiz-form";

export const dynamic = "force-dynamic";

export default async function PlanSetupPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const [me] = await db
    .select({ id: users.id, firstName: users.firstName, planCompletedAt: users.planCompletedAt, onboardedAt: users.onboardedAt })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  // Must have completed onboarding first
  if (!me || !me.onboardedAt) redirect("/onboarding");

  // Already has a plan — go to it
  if (me.planCompletedAt) redirect("/plan");

  return <QuizForm firstName={me.firstName} />;
}
