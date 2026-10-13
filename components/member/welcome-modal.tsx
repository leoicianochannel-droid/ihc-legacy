import Link from "next/link";
import { Button } from "@/components/ui/button";
import { acknowledgeWelcome } from "@/app/(member)/welcome-actions";

/**
 * First-login welcome modal. Renders as a full-screen backdrop-locked
 * dialog — there's no close button and clicking the backdrop does nothing.
 * The only way out is hitting "I'm in — let's go", which calls a server
 * action that stamps `welcome_acknowledged_at` on the user row so this
 * never shows again.
 */
export function WelcomeModal() {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      // Fixed full-viewport overlay, z above the member sidebar / mobile nav
      className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-black/60 backdrop-blur-sm sm:items-center"
    >
      <div className="mx-4 my-8 max-w-2xl rounded-3xl border-2 border-primary/30 bg-card p-6 shadow-2xl ring-4 ring-primary/10 md:p-8">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-xl">✨</span>
          <h2
            id="welcome-title"
            className="font-display text-2xl font-bold md:text-3xl"
          >
            Read this FIRST
          </h2>
        </div>

        <p className="mt-4 font-semibold">
          Welcome to the Infinity Hoop community.
        </p>
        <p className="mt-1 text-sm text-foreground/85 leading-relaxed">
          Whether you've been hooping for years or just unboxed yours yesterday,
          this is your home base. Here's how to get the most out of it:
        </p>

        <ol className="mt-4 space-y-3 text-sm leading-relaxed">
          <li>
            <strong>1. If you're new to the hoop,</strong> start with the{" "}
            <Link href="/programs" className="font-semibold text-primary underline underline-offset-2">
              2 Week Pre-Hoop program
            </Link>{" "}
            — 14 days of bodyweight prep that builds your core strength so the
            hoop feels easy on day 1.
          </li>
          <li>
            <strong>2. Already comfortable hooping?</strong> Jump straight into
            the{" "}
            <Link
              href="/challenges/45-day-challenge"
              className="font-semibold text-primary underline underline-offset-2"
            >
              45-Day Challenge
            </Link>{" "}
            — 6 weeks of progressive workouts you repeat daily.
          </li>
          <li>
            <strong>3. Plan your week</strong> on the{" "}
            <Link href="/dashboard" className="font-semibold text-primary underline underline-offset-2">
              Today dashboard
            </Link>{" "}
            — your streak, today's workout, and today's recipe all live there.
          </li>
          <li>
            <strong>4. Get matched with a buddy</strong> in{" "}
            <Link
              href="/community/buddy"
              className="font-semibold text-primary underline underline-offset-2"
            >
              Community → Buddy
            </Link>{" "}
            — accountability is the secret sauce.
          </li>
          <li>
            <strong>5. Keep showing up.</strong> 20 minutes a day, 5 days a week.
            Consistency beats intensity. You've got this.
          </li>
        </ol>

        <p className="mt-5 rounded-2xl bg-primary/5 p-4 text-sm font-semibold leading-relaxed">
          The single biggest thing that changes your body: doing it daily, even
          when you don't feel like it. <span className="text-primary">Especially when you don't feel like it.</span>
        </p>

        <form action={acknowledgeWelcome} className="mt-6">
          <Button
            type="submit"
            variant="gradient"
            size="lg"
            className="w-full"
          >
            I'm in — let's go ✨
          </Button>
        </form>
      </div>
    </div>
  );
}
