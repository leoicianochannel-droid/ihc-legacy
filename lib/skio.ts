/**
 * Skio integration — verify membership subscriptions via Skio's GraphQL API.
 *
 * Skio is bolted onto Shopify and handles recurring billing for the
 * "Infinity Hoop™ Community & Workouts" subscription product. We don't
 * collect payments ourselves — customers check out at Shopify, Skio bills
 * them, and we just verify membership status to grant/deny access.
 */

const SKIO_ENDPOINT = "https://graphql.skio.com/v1/graphql";

function getSkioKey(): string {
  const key = process.env.SKIO_API_KEY;
  if (!key) throw new Error("SKIO_API_KEY not configured");
  return key;
}

/** Run an arbitrary GraphQL query against Skio. */
async function skioQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(SKIO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `API ${getSkioKey()}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(`Skio query error: ${JSON.stringify(json.errors)}`);
  }
  return json.data as T;
}

export type SkioSubscription = {
  id: string;
  status: string;                                    // ACTIVE | CANCELLED | PAUSED | etc.
  createdAt: string;
  cancelledAt: string | null;
  cyclesCompleted: number | null;
  StorefrontUser?: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  SubscriptionLines?: Array<{
    quantity: number;
    ProductVariant: {
      title: string;
      Product: { title: string; slug: string };
    };
  }>;
};

/**
 * Find all subscriptions for a given customer email. Returns the most recent
 * subscription first. Use `findActiveSubscriptionByEmail()` for the simple
 * "do they have access?" check.
 */
export async function findSubscriptionsByEmail(email: string): Promise<SkioSubscription[]> {
  const data = await skioQuery<{ Subscriptions: SkioSubscription[] }>(
    `query SubsByEmail($email: String!) {
      Subscriptions(
        where: { StorefrontUser: { emailLower: { _eq: $email } } }
        order_by: { createdAt: desc }
      ) {
        id
        status
        createdAt
        cancelledAt
        cyclesCompleted
        StorefrontUser { email firstName lastName }
        SubscriptionLines {
          quantity
          ProductVariant {
            title
            Product { title slug }
          }
        }
      }
    }`,
    { email: email.trim().toLowerCase() }
  );
  return data.Subscriptions ?? [];
}

/**
 * Returns true if the email has any ACTIVE subscription whose product is
 * the Community/Workouts product. Used in the sign-in flow.
 */
export async function hasActiveCommunitySubscription(email: string): Promise<{
  active: boolean;
  subscription: SkioSubscription | null;
}> {
  const subs = await findSubscriptionsByEmail(email);

  // Active = status ACTIVE and at least one subscription line is for our community product.
  // We match BOTH community-product slugs since some legacy subscribers may be on the older
  // "community" product before it was renamed/replaced with "infinity-community".
  const COMMUNITY_PRODUCT_SLUGS = ["infinity-community", "community"];
  const active = subs.find(
    (s) =>
      s.status === "ACTIVE" &&
      (s.SubscriptionLines ?? []).some((line) =>
        COMMUNITY_PRODUCT_SLUGS.includes(line.ProductVariant?.Product?.slug ?? "")
      )
  );

  return { active: !!active, subscription: active ?? null };
}

/* ────────── Shopify checkout URL builders ────────── */

const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN ?? "www.infinityhoop.com";
const COMMUNITY_PRODUCT_HANDLE =
  process.env.SHOPIFY_COMMUNITY_PRODUCT_HANDLE ?? "infinity-community";
const COMMUNITY_SELLING_PLAN_ID =
  process.env.SHOPIFY_COMMUNITY_SELLING_PLAN_ID ?? "4768727281";

/**
 * Build the Shopify product page URL with the right selling plan pre-selected.
 * Shopify subscription products use the product-page → add-to-cart flow rather
 * than direct cart permalinks (the latter returns 410 for selling-plan items).
 */
export function buildCheckoutUrl(opts: {
  email?: string;
  returnUrl?: string;
} = {}): string {
  const params = new URLSearchParams({
    selling_plan: COMMUNITY_SELLING_PLAN_ID,
  });
  if (opts.email) params.set("customer[email]", opts.email);
  if (opts.returnUrl) {
    params.set("attributes[ih_return_url]", opts.returnUrl);
  }

  return `https://${SHOPIFY_DOMAIN}/products/${COMMUNITY_PRODUCT_HANDLE}?${params.toString()}`;
}

/** URL that takes a logged-in member back to manage their existing subscription. */
export function manageSubscriptionUrl(email?: string): string {
  // Skio puts the management page on the merchant's storefront under /a/subscriptions
  // (Skio's Storefront app). Link directly to it.
  const base = `https://${SHOPIFY_DOMAIN}/a/subscriptions`;
  return email ? `${base}?email=${encodeURIComponent(email)}` : base;
}

/** Public storefront customer login URL (Shopify's hosted customer account). */
export const STOREFRONT_ACCOUNT_URL = `https://${SHOPIFY_DOMAIN}/account`;
