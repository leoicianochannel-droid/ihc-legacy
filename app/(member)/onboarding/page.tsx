import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [user] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (user?.onboardedAt) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold">Welcome to Infinity Hoop 💫</h1>
        <p className="mt-3 text-muted-foreground">
          Three quick questions so we can build your plan and match you with the
          perfect accountability buddy. Takes 60 seconds.
        </p>
      </div>
      <OnboardingForm />
    </div>
  );
}
