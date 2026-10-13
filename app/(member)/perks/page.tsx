import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, ExternalLink, Tag, CheckCircle2 } from "lucide-react";

const DISCOUNT_PCT = 70;

const PRODUCTS = [
  {
    title: "Waist Trimmer",
    handle: "infinity-snatched-belt",
    price: 29.99,
    image: "https://cdn.shopify.com/s/files/1/0564/5015/4685/files/40_f86d9c3b-efc3-4b81-97f7-17774456ae4c.png?v=1774067832",
    badge: null,
  },
  {
    title: "Infinity 30-Day Detox Tea",
    handle: "infini-tea-28-day-detox",
    price: 39.99,
    image: "https://cdn.shopify.com/s/files/1/0564/5015/4685/files/72.png?v=1773823074",
    badge: "Bestseller",
  },
  {
    title: "Super Fat Burner",
    handle: "super-fat-burner-with-mct",
    price: 34.99,
    image: "https://cdn.shopify.com/s/files/1/0564/5015/4685/files/71.png?v=1773823093",
    badge: null,
  },
  {
    title: "GLP-1 Patches",
    handle: "berberine-glp-activate-copy",
    price: 34.99,
    image: "https://cdn.shopify.com/s/files/1/0564/5015/4685/files/68.png?v=1773822975",
    badge: null,
  },
  {
    title: "Infinity Sweat Cream",
    handle: "infinity-sweat-cream",
    price: 39.99,
    image: "https://cdn.shopify.com/s/files/1/0564/5015/4685/files/Screenshot_2026-03-17_at_12.37.30_AM.png",
    badge: null,
  },
  {
    title: "Berberine GLP-Activate",
    handle: "pure-berberine-for-weight-loss",
    price: 39.99,
    image: "https://cdn.shopify.com/s/files/1/0564/5015/4685/files/67.png?v=1773822990",
    badge: null,
  },
  {
    title: "Pure Berberine For Weight Loss",
    handle: "berberine",
    price: 39.99,
    image: "https://cdn.shopify.com/s/files/1/0564/5015/4685/files/70.png?v=1773823002",
    badge: null,
  },
  {
    title: "LipoGlow Slimming Belt",
    handle: "red-light-therapy",
    price: 69.99,
    image: "https://cdn.shopify.com/s/files/1/0564/5015/4685/files/41_89e1e3ea-9292-4e0a-9a10-ca672fa63618.png?v=1774067847",
    badge: null,
  },
  {
    title: "Lipoglow Face Wrap",
    handle: "thermaglow-red-light-neck-wrap",
    price: 39.99,
    image: "https://cdn.shopify.com/s/files/1/0564/5015/4685/files/main-image-1.jpg?v=1753586490",
    badge: null,
  },
  {
    title: "Arm Trimmers",
    handle: "arm-trimmers",
    price: 29.99,
    image: "https://cdn.shopify.com/s/files/1/0564/5015/4685/files/Untitleddesign_31.png?v=1753580615",
    badge: null,
  },
  {
    title: "Infinity Resistance Bands",
    handle: "infinity-resistance-bands",
    price: 19.99,
    image: "https://cdn.shopify.com/s/files/1/0564/5015/4685/files/Untitleddesign_80.png?v=1753581280",
    badge: null,
  },
  {
    title: "Knee Support Compression Pads",
    handle: "knee-support",
    price: 19.99,
    image: "https://cdn.shopify.com/s/files/1/0564/5015/4685/files/Screenshot_2025-04-28_at_11.16.35_PM.png?v=1753587003",
    badge: null,
  },
  {
    title: "Infinity Hoop Water Bottle",
    handle: "infinity-hoop-water-bottle",
    price: 29.99,
    image: "https://cdn.shopify.com/s/files/1/0564/5015/4685/files/wataaa.png?v=1774046188",
    badge: null,
  },
  {
    title: "Infinity Workout T-Shirt",
    handle: "dryblend%C2%AE-t-shirt",
    price: 29.99,
    image: "https://cdn.shopify.com/s/files/1/0564/5015/4685/files/unisex-sports-tee-ash-front-678fc97a449a1.jpg?v=1753588514",
    badge: null,
  },
  {
    title: "Infinity Hoop™ Tote Bag",
    handle: "tote-bag",
    price: 19.99,
    image: "https://cdn.shopify.com/s/files/1/0564/5015/4685/files/all-over-print-tote-black-15x15-front-647e3ca327bf5.jpg?v=1753584267",
    badge: null,
  },
  {
    title: "INFINITY VIBRATION PRO",
    handle: "infinity-vibration-plate",
    price: 499.99,
    image: null,
    badge: "Premium",
  },
];

function memberPrice(retail: number) {
  return (retail * (1 - DISCOUNT_PCT / 100)).toFixed(2);
}

export default async function PerksPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-10 md:py-8">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-primary p-8 text-white md:p-10">
        <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent" />
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 size-48 rounded-full bg-white/5" />

        <div className="relative">
          <Badge className="bg-white/20 text-white hover:bg-white/20 border-white/30">
            <Sparkles className="mr-1 size-3" /> Members Only
          </Badge>

          <h1 className="mt-3 font-display text-4xl font-bold leading-tight md:text-5xl">
            70% off<br className="hidden md:block" /> the entire shop
          </h1>
          <p className="mt-2 max-w-md text-base opacity-90">
            Your exclusive member discount — waist trimmers, supplements, accessories, and more.
          </p>

          <div className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-white/15 px-5 py-4 backdrop-blur">
            <CheckCircle2 className="size-6 shrink-0 text-green-300" />
            <div>
              <div className="font-display text-lg font-bold leading-tight">
                Discount automatically applied
              </div>
              <p className="mt-0.5 text-sm opacity-80">
                Just click any product — your member discount is added at checkout.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Products grid ─────────────────────────────────────────────── */}
      <div className="mt-10 flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold">Shop the collection</h2>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <a
            href="https://www.infinityhoop.com/collections/waist-trimmers"
            target="_blank"
            rel="noopener noreferrer"
          >
            View all <ExternalLink className="size-3.5" />
          </a>
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {PRODUCTS.map((product) => {
          const shopUrl = `/api/perks/redirect?handle=${encodeURIComponent(product.handle)}`;
          const discounted = memberPrice(product.price);

          return (
            <a
              key={product.handle}
              href={shopUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col overflow-hidden rounded-2xl border bg-card transition-all hover:border-primary/40 hover:shadow-md"
            >
              {/* Image */}
              <div className="relative aspect-square w-full overflow-hidden bg-muted">
                {product.image ? (
                  <Image
                    src={product.image}
                    alt={product.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    unoptimized
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <Tag className="size-10 opacity-30" />
                  </div>
                )}
                {product.badge && (
                  <div className="absolute left-2 top-2">
                    <Badge className="bg-primary text-white text-[10px] px-1.5 py-0.5">
                      {product.badge}
                    </Badge>
                  </div>
                )}
                <div className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                  -{DISCOUNT_PCT}%
                </div>
              </div>

              {/* Info */}
              <div className="flex flex-1 flex-col p-3">
                <div className="flex-1 text-sm font-semibold leading-snug line-clamp-2">
                  {product.title}
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-lg font-bold text-primary">
                    ${discounted}
                  </span>
                  <span className="text-xs text-muted-foreground line-through">
                    ${product.price.toFixed(2)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-center gap-1 rounded-xl bg-primary/8 py-1.5 text-xs font-semibold text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                  Shop now <ExternalLink className="size-3" />
                </div>
              </div>
            </a>
          );
        })}
      </div>

      <p className="mt-10 rounded-2xl bg-muted/50 p-4 text-center text-xs text-muted-foreground">
        Prices shown are retail. Your exclusive {DISCOUNT_PCT}% member discount is applied automatically at checkout when you click any product above.
      </p>
    </div>
  );
}
