import Stripe from "stripe";

let _stripe: Stripe | null = null;

export const stripe = new Proxy({} as Stripe, {
  get(_t, prop) {
    if (!_stripe) {
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("STRIPE_SECRET_KEY is not set. See .env.example.");
      }
      _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion,
        typescript: true,
        appInfo: { name: "Infinity Hoop Community", version: "0.1.0" },
      });
    }
    return (_stripe as any)[prop];
  },
});

export const STRIPE_PRICES = {
  get monthly() { return process.env.STRIPE_PRICE_MONTHLY!; },
  get annual() { return process.env.STRIPE_PRICE_ANNUAL!; },
};

export const PRICE_DISPLAY = {
  monthly: { amount: 3999, label: "$39.99", period: "month", stripeKey: "monthly" as const },
  annual:  { amount: 29900, label: "$299",   period: "year",  stripeKey: "annual" as const,
             savingsLabel: "Save $180 ($24.92/mo equivalent)" },
};

export type PlanKey = keyof typeof PRICE_DISPLAY;

export async function createCheckoutSession(params: {
  userId: string;
  userEmail: string;
  plan: PlanKey;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
}) {
  const price = STRIPE_PRICES[params.plan];
  if (!price) throw new Error(`Unknown plan: ${params.plan}`);

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: params.userEmail,
    line_items: [{ price, quantity: 1 }],
    subscription_data: {
      trial_period_days: params.trialDays ?? 7,
      metadata: { userId: params.userId, plan: params.plan },
    },
    metadata: { userId: params.userId, plan: params.plan },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
  });
}

export async function createCustomerPortalSession(customerId: string, returnUrl: string) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
