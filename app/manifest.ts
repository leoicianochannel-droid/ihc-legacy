import type { MetadataRoute } from "next";

/**
 * PWA manifest for Infinity Hoop Community.
 * Members can "install" the site to their home screen for an app-like
 * experience: own icon, splash screen, fullscreen, no browser chrome.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Infinity Hoop Community",
    short_name: "Infinity Hoop",
    description:
      "Daily workouts, recipes, and community accountability. Become the best version of you.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#d10352",
    categories: ["fitness", "health", "lifestyle"],
    icons: [
      {
        src: "/icon-192.png?v=2",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png?v=2",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable.png?v=2",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Today",
        short_name: "Today",
        url: "/dashboard",
        description: "Your daily workout and recipe",
      },
      {
        name: "Workouts",
        short_name: "Workouts",
        url: "/workouts",
      },
      {
        name: "Community",
        short_name: "Community",
        url: "/community",
      },
    ],
  };
}
