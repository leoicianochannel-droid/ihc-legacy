import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing",
  "/about",
  "/faq",
  "/terms",
  "/privacy",
  "/cookies",
  "/guidelines",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/join",
  "/admin-join",
  "/admin-join/(.*)",
  "/api/webhooks/(.*)",
  "/api/admin/check-21dr",
  "/api/admin/fix-21dr",
  "/api/admin/regen-21dr",
  "/api/admin/launch-21dr",
  "/api/admin/link-21dr",

  "/.well-known/(.*)",
]);

// Admin role is enforced in app/(admin)/admin/layout.tsx against the DB —
// middleware just ensures you're authenticated for any non-public route.
export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
