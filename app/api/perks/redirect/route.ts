import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const DISCOUNT_CODE = process.env.MEMBER_DISCOUNT_CODE ?? "MEMBER70";
const SHOP_BASE = "https://www.infinityhoop.com";

// Allowlist of valid product handles — prevents open-redirect abuse.
const ALLOWED_HANDLES = new Set([
  "infinity-snatched-belt",
  "infini-tea-28-day-detox",
  "super-fat-burner-with-mct",
  "berberine-glp-activate-copy",
  "infinity-sweat-cream",
  "pure-berberine-for-weight-loss",
  "berberine",
  "red-light-therapy",
  "thermaglow-red-light-neck-wrap",
  "arm-trimmers",
  "infinity-resistance-bands",
  "knee-support",
  "infinity-hoop-water-bottle",
  "dryblend%C2%AE-t-shirt",
  "tote-bag",
  "infinity-vibration-plate",
]);

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const handle = req.nextUrl.searchParams.get("handle") ?? "";
  if (!ALLOWED_HANDLES.has(handle)) {
    return NextResponse.redirect(`${SHOP_BASE}/collections/waist-trimmers`);
  }

  // /discount/CODE?redirect=/products/HANDLE sets a Shopify discount cookie
  // then forwards the user to the product page — code never surfaces in the final URL.
  const destination = `${SHOP_BASE}/discount/${DISCOUNT_CODE}?redirect=/products/${handle}`;
  return NextResponse.redirect(destination);
}
