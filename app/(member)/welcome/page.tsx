import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import {
  PlayCircle,
  Users,
  Salad,
  ChevronDown,
  Mail,
  Instagram,
  MessageCircle,
  Settings,
  ArrowRight,
  CircleHelp,
} from "lucide-react";
import { getWelcomeVideo } from "@/lib/welcome-video";
import { WatchTourButton } from "./watch-tour-button";
import { ManageSubscriptionButton } from "@/components/member/retention-modal";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  const welcomeVideo = await getWelcomeVideo();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-10 md:py-10">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-3xl hoop-gradient-bold px-8 py-12 md:px-14 md:py-16 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-transparent to-black/10" />
        <div className="relative max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-widest opacity-80">Need Help?</p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-tight md:text-5xl">
            Hey {me?.firstName ?? "friend"}, we've got you. 👋
          </h1>
          <p className="mt-4 text-lg opacity-90 leading-relaxed">
            Everything you need to get started, get answers, and get results — all in one place.
          </p>
          {welcomeVideo && (
            <div className="mt-6">
              <WatchTourButton
                videoUid={welcomeVideo.uid}
                customerCode={welcomeVideo.customerCode}
                durationSec={welcomeVideo.durationSec}
                embedUrl={welcomeVideo.embedUrl}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Start Here paths ── */}
      <div className="mt-10">
        <h2 className="font-display text-2xl font-bold">Where do I start?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Pick the path that's right for you.</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* Path A */}
          <Link
            href="/programs/2-week-pre-hoop"
            className="group relative overflow-hidden rounded-2xl border bg-primary/5 p-6 transition-all hover:shadow-lg hover:bg-primary/10"
          >
            <div className="text-3xl">🔰</div>
            <h3 className="mt-3 font-display text-xl font-bold">New to hooping?</h3>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              Start with the <strong>2-Week Pre-Hoop</strong> program — 14 days of bodyweight prep so the hoop feels effortless on day 1.
            </p>
            <div className="mt-4 flex items-center gap-1 text-sm font-bold text-primary">
              Start the program <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Path B */}
          <Link
            href="/challenges/30-day-challenge"
            className="group relative overflow-hidden rounded-2xl border bg-amber-50 p-6 transition-all hover:shadow-lg hover:bg-amber-100 dark:bg-amber-950/20"
          >
            <div className="text-3xl">🔥</div>
            <h3 className="mt-3 font-display text-xl font-bold">Ready to level up?</h3>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              Jump into the <strong>30-Day Challenge</strong> — 4 weeks of progressive workouts, daily check-ins, and real results.
            </p>
            <div className="mt-4 flex items-center gap-1 text-sm font-bold text-amber-600">
              Join the challenge <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </div>

      {/* ── Quick links ── */}
      <div className="mt-10">
        <h2 className="font-display text-2xl font-bold">Quick access</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: PlayCircle, label: "Workouts", href: "/workouts" },
            { icon: Salad, label: "Recipes", href: "/recipes" },
            { icon: Users, label: "Community", href: "/community" },
            { icon: Settings, label: "Settings", href: "/settings" },
          ].map(({ icon: Icon, label, href }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-md"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                <Icon className="size-5 text-primary" />
              </div>
              <span className="text-sm font-semibold">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Collapsible sections ── */}
      <div className="mt-10 space-y-3">

        {/* Hoop tips */}
        <details className="group overflow-hidden rounded-2xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between p-5 hover:bg-muted/30">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💫</span>
              <span className="font-display text-lg font-bold">Hoop tips & setup</span>
            </div>
            <ChevronDown className="size-5 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="border-t px-5 pb-5 pt-4 space-y-4 text-sm leading-relaxed text-foreground/80">
            <div>
              <p className="font-semibold text-foreground mb-1">Setting up your hoop</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Click each section together until they form a complete circle (no gaps).</li>
                <li>Make sure all the magnets are firmly connected — listen for the snap.</li>
                <li>Hoop should sit at your waist, not hips. Adjust links if too small/large.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">How to hoop (the basics)</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Stand with one foot slightly in front of the other.</li>
                <li>Push the hoop forward and back — not side-to-side.</li>
                <li>Keep your core engaged. That's what keeps the hoop moving.</li>
                <li>Don't worry about dropping it. Everyone drops it. That's how you learn.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">What to wear</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>A snug-fitting top — avoid loose fabric that catches the hoop.</li>
                <li>Leggings or fitted shorts.</li>
                <li>If bruising, our Waist Trimmer adds padding between you and the hoop.</li>
              </ul>
            </div>
          </div>
        </details>

        {/* FAQ */}
        <details className="group overflow-hidden rounded-2xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between p-5 hover:bg-muted/30">
            <div className="flex items-center gap-3">
              <span className="text-2xl">❓</span>
              <span className="font-display text-lg font-bold">Frequently asked questions</span>
            </div>
            <ChevronDown className="size-5 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="border-t px-5 pb-5 pt-4 space-y-2">
            {[
              {
                q: "When will I see results?",
                a: "Most members notice energy and core strength changes in the first 2 weeks. Visible body changes typically show at 4–6 weeks of consistent daily hooping (20+ min/day).",
              },
              {
                q: "What if I miss a day?",
                a: "No problem. You get one freeze token — it'll automatically protect your streak. Two days off in a row resets the counter, but your progress photos and tracking stay.",
              },
              {
                q: "Is the hoop hard on my back?",
                a: "The Infinity Hoop is designed to be back-friendly — it doesn't require the spinal twist of a traditional hoop. If you have a serious back issue, start with the 2-Week Pre-Hoop program to build core support first.",
              },
              {
                q: "Can I use it if I'm pregnant?",
                a: "Talk to your doctor first. We don't recommend hooping during pregnancy. After birth, wait until your provider clears you for core work (usually 6–12 weeks postpartum).",
              },
              {
                q: "My hoop keeps falling apart — help!",
                a: "Usually a magnet alignment issue. Line up the gold magnet pieces inside before clicking, and make sure you hear a snap. Email vip@infinityhoop.com for same-day help.",
              },
              {
                q: "How do I cancel my subscription?",
                a: 'Click "Manage subscription" below — no hard sells, no penalties.',
              },
            ].map(({ q, a }) => (
              <details key={q} className="group/faq rounded-xl border">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 hover:bg-muted/30">
                  <span className="text-sm font-semibold">{q}</span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open/faq:rotate-180" />
                </summary>
                <p className="border-t px-4 pb-3 pt-2 text-sm text-foreground/80">{a}</p>
              </details>
            ))}
          </div>
        </details>

        {/* Community guidelines */}
        <details className="group overflow-hidden rounded-2xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between p-5 hover:bg-muted/30">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌀</span>
              <span className="font-display text-lg font-bold">Community guidelines</span>
            </div>
            <ChevronDown className="size-5 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="border-t px-5 pb-5 pt-4">
            <ul className="space-y-3 text-sm">
              {[
                ["💜", "Judgment-Free Zone", "No hate, bullying, or disrespect. We're here to lift each other up."],
                ["🎉", "Be Kind & Supportive", "Encourage, motivate, and celebrate each other's wins — big or small."],
                ["🎯", "Stay on Topic", "Hooping wins, fitness tips, questions, and positive vibes."],
                ["📧", "No Support Questions in Posts", "Email vip@infinityhoop.com for order/support help — it keeps the feed focused."],
                ["🚫", "No Spam or Self-Promotion", "No promoting personal products or external links."],
                ["🔒", "Respect Privacy", "Don't share screenshots or private conversations without permission."],
              ].map(([emoji, title, desc]) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="text-lg leading-none mt-0.5">{emoji}</span>
                  <div>
                    <span className="font-semibold">{title}</span>
                    <span className="text-muted-foreground"> — {desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </details>

      </div>

      {/* ── Contact support ── */}
      <div className="mt-10">
        <h2 className="font-display text-2xl font-bold">Need help?</h2>
        <p className="mt-1 text-sm text-muted-foreground">We're here for you. Three ways to reach us.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <a
            href="mailto:vip@infinityhoop.com"
            className="flex flex-col gap-2 rounded-2xl border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md"
          >
            <Mail className="size-6 text-primary" />
            <div className="font-semibold">Email VIP support</div>
            <div className="text-xs text-muted-foreground">vip@infinityhoop.com · 24h response</div>
          </a>
          <Link
            href="/community"
            className="flex flex-col gap-2 rounded-2xl border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md"
          >
            <MessageCircle className="size-6 text-primary" />
            <div className="font-semibold">Ask the community</div>
            <div className="text-xs text-muted-foreground">Post a question in the feed — members & admins answer fast</div>
          </Link>
          <a
            href="https://instagram.com/infinityhoop"
            target="_blank"
            rel="noreferrer"
            className="flex flex-col gap-2 rounded-2xl border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md"
          >
            <Instagram className="size-6 text-primary" />
            <div className="font-semibold">DM on Instagram</div>
            <div className="text-xs text-muted-foreground">@infinityhoop · for non-urgent questions</div>
          </a>
        </div>
      </div>

      {/* ── Manage subscription ── */}
      <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border bg-muted/30 p-6 text-center">
        <CircleHelp className="size-8 text-muted-foreground" />
        <div>
          <p className="font-semibold">Need to manage your subscription?</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Update payment, pause, or cancel — no hard sells.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <ManageSubscriptionButton label="Manage subscription" variant="outline" size="sm" />
          <Button asChild variant="ghost" size="sm">
            <Link href="/settings">Account settings</Link>
          </Button>
        </div>
      </div>

    </div>
  );
}
