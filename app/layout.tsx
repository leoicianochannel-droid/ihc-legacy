import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Barlow_Condensed } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { CookieBanner } from "@/components/cookie-banner";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Infinity Hoop Community — Become the best version of you",
    template: "%s | Infinity Hoop",
  },
  description:
    "Join 8,000+ women using the Infinity Hoop and a daily plan of workouts, recipes, and accountability to feel amazing in their body.",
  keywords: ["infinity hoop", "weighted hula hoop", "weight loss", "women fitness", "at home workout"],
  applicationName: "Infinity Hoop",
  appleWebApp: {
    // iOS-specific PWA flags. These let the app install full-screen on the
    // home screen with our pink status bar.
    capable: true,
    title: "Infinity Hoop",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.png?v=3", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png?v=3", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png?v=3", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=3", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Infinity Hoop Community",
    description: "Fun daily movement, real results, a community that has your back.",
    url: "https://members.infinityhoop.com",
    siteName: "Infinity Hoop",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Infinity Hoop Community",
    description: "Fun daily movement, real results, a community that has your back.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF7" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
  ],
  width: "device-width",
  initialScale: 1,
  // Don't block pinch-zoom — that's an a11y violation. iOS auto-zoom-on-focus
  // is now prevented by ensuring inputs use 16px+ font.
  maximumScale: 5,
  // Use the full screen including the safe-area regions; we apply
  // env(safe-area-inset-*) padding where it matters (e.g. bottom nav).
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#d10352",
          colorText: "#0A0A0A",
          colorBackground: "#FFFFFF",
          borderRadius: "0.75rem",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
        },
      }}
      // Branded copy overrides — replaces Clerk's generic "Welcome! Please
      // fill in the details to get started." with shorter, on-brand text
      // that won't wrap awkwardly on small screens.
      localization={{
        signUp: {
          start: {
            title: "Welcome to Infinity Hoop",
            subtitle: "Create your account in 30 seconds.",
            actionText: "Already have an account?",
            actionLink: "Sign in",
          },
        },
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to keep going.",
            actionText: "New here?",
            actionLink: "Create an account",
          },
        },
      }}
    >
      <html lang="en" className={`${plusJakartaSans.variable} ${barlowCondensed.variable}`} suppressHydrationWarning>
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `(() => { try { const t = localStorage.getItem('theme'); if (t === 'dark') document.documentElement.classList.add('dark'); else if (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark'); } catch {} })();`,
            }}
          />
        </head>
        <body>
          {children}
          <ServiceWorkerRegister />
          <InstallPrompt />
          <CookieBanner />
        </body>
      </html>
    </ClerkProvider>
  );
}
