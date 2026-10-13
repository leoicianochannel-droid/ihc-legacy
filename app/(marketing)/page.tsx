import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  Trophy,
  Heart,
  Users,
  PlayCircle,
  Salad,
  Flame,
  Calendar,
  Star,
  Check,
  ArrowRight,
} from "lucide-react";
import { db, workouts, recipes } from "@/lib/db";
import { and, eq, isNotNull, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function getLibraryCounts() {
  try {
    const [w] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(workouts)
      .where(and(eq(workouts.challengeOnly, false), isNotNull(workouts.publishedAt)));
    const [r] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(recipes)
      .where(isNotNull(recipes.publishedAt));
    return { workouts: Number(w?.n ?? 0), recipes: Number(r?.n ?? 0) };
  } catch {
    return { workouts: 0, recipes: 0 };
  }
}

export default async function HomePage() {
  const counts = await getLibraryCounts();
  return (
    <>
      {/* ───────────────────── HERO ───────────────────── */}
      <section className="relative overflow-hidden bg-white">
        <div className="container relative grid gap-12 py-20 md:py-28 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6 animate-slide-up">
            <Badge variant="gold" className="uppercase tracking-wider">
              <Sparkles className="mr-1 size-3" /> New platform • 8,000+ members
            </Badge>
            <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
              Become the{" "}
              <span className="hoop-text-gradient">best version</span> of you.
              <br />
              One hoop. One plan. One community.
            </h1>
            <p className="max-w-xl text-lg text-foreground/80 md:text-xl">
              The official Infinity Hoop membership. A daily plan of fun
              hooping workouts, fat-loss recipes, and a community of 8,000+
              real women who will cheer you on every single day.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="gradient">
                <Link href="/sign-up">
                  Start your 7-day free trial
                  <ArrowRight className="ml-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/#how-it-works">See how it works</Link>
              </Button>
            </div>
            <div className="flex items-center gap-4 pt-4 text-sm text-muted-foreground">
              <div className="flex -space-x-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-8 w-8 rounded-full border-2 border-background bg-primary/30"
                  />
                ))}
              </div>
              <div className="flex items-center gap-1">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className="font-semibold text-foreground">4.9</span>
                <span>from 2,300+ members</span>
              </div>
            </div>
          </div>

          {/* Hero visual — placeholder stack of cards until real member photos land */}
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="hoop-card relative aspect-[3/4] overflow-hidden p-0">
                  <Image
                    src="/challenge-hero.jpg"
                    alt="45-Day Challenge workout"
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  <div className="absolute inset-0 flex flex-col justify-end p-5 text-white">
                    <Badge className="w-fit bg-black/70 text-white">DAY 12</Badge>
                    <p className="mt-3 font-display text-2xl font-bold leading-tight">
                      45-Day Challenge
                    </p>
                    <p className="text-sm text-white/90">Today: Core + Glutes, 25 min</p>
                  </div>
                </div>
                <Card className="p-5">
                  <div className="flex items-center gap-3">
                    <Flame className="size-8 text-primary" />
                    <div>
                      <div className="font-display text-3xl font-bold">47</div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">
                        Day streak
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
              <div className="mt-8 space-y-4">
                <Card className="p-5">
                  <div className="flex items-center gap-3">
                    <Heart className="size-8 text-primary" />
                    <div>
                      <div className="font-semibold">Your buddy: Jess M.</div>
                      <div className="text-xs text-muted-foreground">
                        Crushed her workout today 🔥
                      </div>
                    </div>
                  </div>
                </Card>
                <div className="hoop-card relative aspect-[3/4] overflow-hidden p-0">
                  <Image
                    src="/recipes/greek-yogurt-and-nut-granola-parfait.jpg"
                    alt="High-protein recipe"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  <div className="absolute inset-0 flex flex-col justify-end p-5 text-white">
                    <Badge className="w-fit bg-black/70 text-white">RECIPE</Badge>
                    <p className="mt-3 font-display text-2xl font-bold leading-tight">
                      High-protein berry bowl
                    </p>
                    <p className="text-sm text-white/80">340 cal • 8 min</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── "AS SEEN IN" BAR ───────────── */}
      <section className="border-y border-foreground/5 bg-background py-8">
        <div className="container">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Trusted by 8,000+ women transforming their bodies
          </p>
        </div>
      </section>

      {/* ───────────── WHAT YOU GET ───────────── */}
      <section id="what-you-get" className="container py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="uppercase tracking-wider">
            What's inside
          </Badge>
          <h2 className="mt-4 font-display text-4xl font-bold md:text-5xl">
            Everything you need to{" "}
            <span className="hoop-text-gradient">actually</span> see results
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Not another library of random videos. A daily system designed for
            women 25–55 who want fun, do-able movement and real accountability.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: PlayCircle,
              title: `${counts.workouts} hoop workouts`,
              body: "10, 20, 30, 45-min. Beginner to advanced. Core, legs, full body, dance cardio. Premium HD video you can stream anywhere.",
            },
            {
              icon: Salad,
              title: `${counts.recipes} fat-loss recipes`,
              body: "Each with calories and macros. Tap the ones you'll make this week → auto-generated grocery list. No more meal planning headaches.",
            },
            {
              icon: Flame,
              title: "Streaks that stick",
              body: "Daily check-ins, milestone badges, freeze tokens for bad days. The feedback loop that makes showing up addictive.",
            },
            {
              icon: Users,
              title: "Matched accountability buddy",
              body: "We pair you with a member who has your same schedule and vibe. Private check-ins. Real friendship. Nobody does this alone.",
            },
            {
              icon: Trophy,
              title: "Live 45-day challenges",
              body: "Time-bound challenges with leaderboards, daily unlocks, and real prizes. When the timer's running, you'll show up.",
            },
            {
              icon: Calendar,
              title: "Your personal plan",
              body: "Tell us your goals and schedule. We build a calendar of workouts, recipes, and check-ins just for you. Open the app, do today's thing, close the app.",
            },
          ].map((f) => (
            <Card key={f.title} className="transition-all hover:shadow-md">
              <CardContent className="space-y-3 p-6">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <f.icon className="size-6" />
                </div>
                <h3 className="font-display text-xl font-bold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ───────────── HOW IT WORKS ───────────── */}
      <section id="how-it-works" className="bg-muted/30 py-20 md:py-28">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="uppercase tracking-wider">
              How it works
            </Badge>
            <h2 className="mt-4 font-display text-4xl font-bold md:text-5xl">
              Three steps. That's it.
            </h2>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Join the community",
                body: "Sign up, tell us your goals and what kind of mover you are. We match you with a buddy and build your plan.",
              },
              {
                step: "02",
                title: "Open the app, do today's thing",
                body: "Your dashboard shows today's workout, today's recipe, and a quick check-in. 20 minutes, done. Streak goes up.",
              },
              {
                step: "03",
                title: "Watch your body change",
                body: "Private progress gallery tracks your weight, measurements, and photos. Celebrate wins with your buddy and 8,000+ women who get it.",
              },
            ].map((s) => (
              <div key={s.step} className="relative">
                <div className="hoop-text-gradient font-display text-7xl font-bold opacity-30">
                  {s.step}
                </div>
                <h3 className="mt-2 font-display text-2xl font-bold">{s.title}</h3>
                <p className="mt-3 text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── PRICING TEASE ───────────── */}
      <section id="pricing" className="container py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="uppercase tracking-wider">
            Pricing
          </Badge>
          <h2 className="mt-4 font-display text-4xl font-bold md:text-5xl">
            One price. Everything included.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            7-day free trial. Cancel anytime. Join 8,000+ women already inside.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-md">
          <Card className="relative overflow-hidden border-primary p-8 ring-2 ring-primary/30">
            <h3 className="font-display text-2xl font-bold">Monthly membership</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="font-display text-5xl font-bold">$39.99</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Cancel anytime. 7-day free trial.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                `Full access to ${counts.workouts} workouts`,
                "All recipes + grocery list",
                "Matched buddy + community",
                "Active challenges",
                "Progress tracking",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <Button asChild variant="gradient" size="lg" className="mt-8 w-full">
              <Link href="/sign-up">Start free trial</Link>
            </Button>
          </Card>
        </div>
      </section>

      {/* ───────────── CLOSING CTA ───────────── */}
      <section className="relative overflow-hidden bg-foreground py-20 text-background md:py-28">
        <div className="absolute inset-0 hoop-gradient-bold opacity-50" aria-hidden />
        <div className="container relative text-center">
          <h2 className="font-display text-4xl font-bold md:text-6xl">
            Your next 45 days can change everything.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg opacity-90">
            Stop collecting workout apps. Start showing up. Your plan, your
            buddy, and 8,000+ women are waiting inside.
          </p>
          <Button asChild size="lg" variant="default" className="mt-10 bg-white text-foreground hover:bg-white/90">
            <Link href="/sign-up">
              Start your 7-day free trial <ArrowRight className="ml-1" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
