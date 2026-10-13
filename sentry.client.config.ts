/**
 * Sentry — client-side initialization.
 *
 * Loaded by Next.js automatically when present at the project root.
 * No-ops cleanly when NEXT_PUBLIC_SENTRY_DSN is missing so dev / preview
 * builds without Sentry credentials don't error.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    // Sample a fraction of transactions for performance monitoring. 10% is
    // plenty for 10K members — keeps costs sane.
    tracesSampleRate: 0.1,
    // Session replays — capture 5% of sessions in case you want to see what
    // a member was doing before an error. 100% of error sessions are always
    // captured so you don't miss bugs that crash people.
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    // Filter out known-noisy errors that come from browser extensions, ad
    // blockers, or third-party scripts we don't control.
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed",
      "Non-Error promise rejection captured",
      // Chrome extension noise
      /chrome-extension:\/\//,
      /moz-extension:\/\//,
    ],
  });
}
