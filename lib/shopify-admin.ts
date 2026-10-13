/**
 * Shopify Admin API — discount code generation
 *
 * Each community member gets a unique, traceable discount code.
 * Codes are generated under a single Price Rule (70% off, all products).
 *
 * Required env vars:
 *   SHOPIFY_ADMIN_TOKEN   — Admin API access token from Shopify Admin →
 *                           Settings → Apps → Develop apps → your app → Admin API access token
 *   SHOPIFY_MYSHOPIFY_DOMAIN — e.g. "infinity-hoop.myshopify.com"
 *   SHOPIFY_PRICE_RULE_ID — ID of the 70%-off price rule (see createPriceRule() below)
 */

const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const SHOP_DOMAIN = process.env.SHOPIFY_MYSHOPIFY_DOMAIN;
const API_VERSION = "2025-01";

function adminUrl(path: string) {
  return `https://${SHOP_DOMAIN}/admin/api/${API_VERSION}${path}`;
}

async function shopifyFetch(path: string, options: RequestInit = {}) {
  if (!ADMIN_TOKEN || !SHOP_DOMAIN) {
    throw new Error("Shopify Admin API not configured (missing SHOPIFY_ADMIN_TOKEN or SHOPIFY_MYSHOPIFY_DOMAIN)");
  }
  const res = await fetch(adminUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": ADMIN_TOKEN,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shopify API ${res.status}: ${body}`);
  }
  return res.json();
}

/**
 * One-time setup: create the 70%-off price rule in Shopify.
 * Run this once, then save the returned ID as SHOPIFY_PRICE_RULE_ID.
 * You can also create it manually in Shopify Admin → Discounts → Create discount.
 */
export async function createPriceRule() {
  const data = await shopifyFetch("/price_rules.json", {
    method: "POST",
    body: JSON.stringify({
      price_rule: {
        title: "Community Member 70% Off",
        target_type: "line_item",
        target_selection: "all",
        allocation_method: "across",
        value_type: "percentage",
        value: "-70.0",
        customer_selection: "all",
        starts_at: new Date().toISOString(),
        usage_limit: null,         // unlimited total uses (each code is unique per member)
        once_per_customer: false,  // the per-member uniqueness is handled by us, not Shopify
      },
    }),
  });
  return data.price_rule as { id: number; title: string };
}

/**
 * Generate a unique Shopify discount code for a member.
 * Code format: IH-{FIRSTNAME}-{6_RANDOM_CHARS}  e.g.  IH-ASHLEY-X7K2A9
 */
export async function generateMemberCode(firstName: string | null): Promise<string> {
  const priceRuleId = process.env.SHOPIFY_PRICE_RULE_ID;
  if (!priceRuleId) {
    throw new Error("SHOPIFY_PRICE_RULE_ID not set");
  }

  // Build a unique-ish code
  const name = (firstName ?? "MEMBER")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  const code = `IH-${name}-${suffix}`;

  await shopifyFetch(`/price_rules/${priceRuleId}/discount_codes.json`, {
    method: "POST",
    body: JSON.stringify({ discount_code: { code } }),
  });

  return code;
}

/** Check whether Shopify Admin API is configured in this environment. */
export function isShopifyAdminConfigured() {
  return !!(
    process.env.SHOPIFY_ADMIN_TOKEN &&
    process.env.SHOPIFY_MYSHOPIFY_DOMAIN &&
    process.env.SHOPIFY_PRICE_RULE_ID
  );
}
