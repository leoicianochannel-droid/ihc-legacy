/**
 * Sentry — server-side initialization.
 * Loaded automatically by Next.js when present at the project root.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // Don't send 404s — they're noise at scale.
    beforeSend(event) {
      if (event.exception?.values?.[0]?.value?.includes("NEXT_NOT_FOUND")) {
        return null;
      }
      return event;
    },
  });
}
