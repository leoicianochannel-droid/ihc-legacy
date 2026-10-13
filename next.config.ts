import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.mux.com" },
      { protocol: "https", hostname: "videodelivery.net" },
      { protocol: "https", hostname: "*.cloudflarestream.com" },
      { protocol: "https", hostname: "iframe.videodelivery.net" },
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "*.blob.vercel-storage.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "cdn.shopify.com" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};

// Sentry config — uploads source maps when SENTRY_AUTH_TOKEN is set in CI,
// silent when it isn't (so dev / preview builds work without credentials).
// withSentryConfig is a no-op for the runtime — Sentry.init in the config
// files is what actually wires error capture.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Suppress all logs unless explicitly enabled
  silent: !process.env.CI,
  // Route browser SDK requests through our own domain to bypass ad blockers
  tunnelRoute: "/monitoring",
  // Widen the source map upload so SSR + client both get good stack traces
  widenClientFileUpload: true,
});
