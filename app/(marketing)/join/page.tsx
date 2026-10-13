import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Gift } from "lucide-react";
import { buildCheckoutUrl } from "@/lib/skio";
import { getAppUrl } from "@/lib/app-url";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { RefStore } from "./ref-store";

const FEATURES = [
  "Hoop workouts for every level, 10–45 min",
  "High-protein recipes + auto grocery list",
  "6-week Infinity Hoop Challenge",
  "Matched accountability buddy",
  "Private progress gallery",
  "Daily streak + milestone rewards",
  "Community of 8,000+ women",
  "Cancel anytime — no long-term contracts",
];

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const params = await searchParams;
  const ref = params.ref?.trim().toUpperCase() || null;

  // Look up the referrer's first name for personalisation
  let referrerName: string | null = null;
  if (ref) {
    const [referrer] = await db
      .select({ firstName: users.firstName })
      .from(users)
      .where(eq(users.referralCode, ref))
      .limit(1);
    if (referrer?.firstName) referrerName = referrer.firstName;
  }

  // After Shopify checkout, Shopify sends them back here → then to /sign-up
  // so the Clerk account creation happens after they've paid.
  const checkoutUrl = buildCheckoutUrl({
    returnUrl: `${getAppUrl()}/sign-up`,
  });

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 hoop-gradient opacity-30" aria-hidden />
      <div className="container relative py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          {ref && (
            <div className="mb-6 inline-flex items-center gap-2 rounded-2xl border-2 border-primary/30 bg-primary/5 px-5 py-3 text-sm font-semibold text-primary">
              <Gift className="size-4 shrink-0" />
              {referrerName
                ? `${referrerName} invited you to join!`
                : "A friend invited you to join!"}
            </div>
          )}

          <Badge variant="gold" className="uppercase tracking-wider">
            30-Day Free Trial
          </Badge>

          <h1 className="mt-4 font-display text-5xl font-bold md:text-6xl">
            Your accountability community awaits
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
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>

            <Button asChild variant="gradient" size="lg" className="mt-10 w-full">
              <a href={checkoutUrl}>Start your free trial</a>
            </Button>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Step 1 of 2 — purchase on Shopify, then create your community account.
            </p>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Powered by Shopify checkout. We never see your card.
            </p>
          </Card>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already a member?{" "}
            <Link href="/sign-in" className="font-semibold text-primary underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Stores ref code in localStorage so onboarding picks it up */}
      {ref && <RefStore code={ref} />}
    </div>
  );
}
