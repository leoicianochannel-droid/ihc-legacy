import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles } from "lucide-react";
import { buildCheckoutUrl } from "@/lib/skio";
import { getAppUrl } from "@/lib/app-url";
import { db, workouts, recipes } from "@/lib/db";
import { and, eq, isNotNull, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const { userId } = await auth();
  const me = userId ? await currentUser() : null;
  const email = me?.emailAddresses?.[0]?.emailAddress;

  // Real library counts so marketing copy stays honest as content grows.
  let workoutCount = 0;
  let recipeCount = 0;
  try {
    const [w] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(workouts)
      .where(and(eq(workouts.challengeOnly, false), isNotNull(workouts.publishedAt)));
    workoutCount = Number(w?.n ?? 0);
    const [r] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(recipes)
      .where(isNotNull(recipes.publishedAt));
    recipeCount = Number(r?.n ?? 0);
  } catch {}

  const features = [
    `${workoutCount} hoop workouts, 10–45 min`,
    `${recipeCount} high-protein recipes + auto grocery list`,
    "6-week Infinity Hoop Challenge",
    "Matched accountability buddy",
    "Private progress gallery",
    "Daily streak + milestone rewards",
    "Community of 8,000+ women",
    "Cancel anytime — no long-term contracts",
  ];

  const checkoutUrl = buildCheckoutUrl({
    email: email,
    returnUrl: getAppUrl(),
  });

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 hoop-gradient opacity-30" aria-hidden />
      <div className="container relative py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="gold" className="uppercase tracking-wider">
            <Sparkles className="mr-1 size-3" /> 30-Day Free Trial
          </Badge>
          <h1 className="mt-4 font-display text-5xl font-bold md:text-6xl">
            One plan. Everything in.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Try it free for a month. If you love it, stay. If not, cancel — no charge, no
            questions.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-md">
          <Card className="relative overflow-hidden border-primary p-10 ring-2 ring-primary/30 hoop-glow">
            <div className="absolute -right-1 -top-1">
              <Badge variant="gold" className="rounded-bl-2xl rounded-tr-2xl uppercase">
                Members
              </Badge>
            </div>
            <h2 className="font-display text-3xl font-bold">Infinity Hoop Membership</h2>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-2xl font-semibold text-muted-foreground">FREE</span>
              <span className="text-muted-foreground">for 30 days</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Then <span className="font-semibold text-foreground">$39.99/month</span>. Cancel
              anytime.
            </p>

            <ul className="mt-8 space-y-3 text-sm">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>

            <Button asChild variant="gradient" size="lg" className="mt-10 w-full">
              <a href={checkoutUrl}>
                {userId ? "Start your free trial" : "Sign up to start"}
              </a>
            </Button>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Powered by Shopify checkout. We never see your card.
            </p>
          </Card>

          {!userId && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already a member?{" "}
              <Link href="/sign-in" className="font-semibold text-primary underline">
                Sign in
              </Link>
            </p>
          )}
        </div>

        <div className="mx-auto mt-20 max-w-2xl">
          <h3 className="font-display text-2xl font-bold">FAQ</h3>
          <div className="mt-6 space-y-5 text-sm">
            <div>
              <div className="font-semibold">Can I cancel anytime?</div>
              <p className="text-muted-foreground">
                Yes. Manage your subscription from your member settings. If you cancel during
                your 30-day free trial, you won't be charged.
              </p>
            </div>
            <div>
              <div className="font-semibold">I bought my hoop on infinityhoop.com — is this different?</div>
              <p className="text-muted-foreground">
                Yes. The hoop is a physical product. The membership ($39.99/month) is the
                community + workouts + recipes platform. Many members have both.
              </p>
            </div>
            <div>
              <div className="font-semibold">Where does payment happen?</div>
              <p className="text-muted-foreground">
                On Shopify (the same checkout you'd use to buy a hoop). Subscription billing
                is handled by Skio. We never store your card on this platform.
              </p>
            </div>
            <div>
              <div className="font-semibold">I'm already a Skool member — do I need to pay again?</div>
              <p className="text-muted-foreground">
                If your membership is active in Skio (most existing community members), just
                sign up here with the same email — we'll detect your subscription and grant
                access automatically. If you're not yet a member, you can start the free trial
                here.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
