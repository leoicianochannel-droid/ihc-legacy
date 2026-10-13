import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Infinity Hoop logo — uses the official brand image files.
 *
 * Variants:
 *  - "dark"     → black wordmark on transparent bg (default, for light surfaces)
 *  - "light"    → inverted to white (for dark surfaces)
 *  - "gradient" → same as dark (gradient not applicable to raster image)
 *
 * Layouts:
 *  - "horizontal" (default) → INFINITYHOOP on one line
 *  - "stacked"              → INFINITY / HOOP stacked (square icon format)
 */
export function Logo({
  className,
  variant = "dark",
  layout = "horizontal",
}: {
  className?: string;
  variant?: "dark" | "light" | "gradient";
  layout?: "horizontal" | "stacked";
}) {
  const src = layout === "stacked" ? "/logo-stacked.png" : "/logo.png";

  return (
    <Image
      src={src}
      alt="Infinity Hoop"
      width={layout === "stacked" ? 200 : 600}
      height={layout === "stacked" ? 200 : 100}
      className={cn(
        "w-auto object-contain",
        layout === "horizontal" ? "h-8" : "h-16",
        // "light" variant = always white (for colored/dark hero backgrounds)
        // "dark" variant (default) = dark in light mode, auto-inverts in dark mode
        variant === "light" ? "invert" : "dark:invert",
        className
      )}
      priority
    />
  );
}
