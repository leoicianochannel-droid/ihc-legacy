"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ChipOption = { key: string; label: ReactNode; href: string; active: boolean };

/**
 * One-line, swipeable row of filter chips. The tapped chip lights up right
 * away (before the filtered page arrives) and the page keeps its scroll
 * position instead of jumping back to the top.
 */
export function ChipRow({
  label,
  options,
  size = "sm",
  className,
}: {
  label?: string;
  options: ChipOption[];
  size?: "sm" | "xs";
  className?: string;
}) {
  const pathname = usePathname();
  const search = useSearchParams()?.toString();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => setPending(null), [pathname, search]);

  const activeKey = pending ?? options.find((o) => o.active)?.key ?? null;

  return (
    <div className={cn("scroll-row scroll-row-bleed items-center gap-2 py-1", className)}>
      {label && (
        <span className="pr-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      )}
      {options.map((o) => {
        const active = o.key === activeKey;
        return (
          <Link
            key={o.key}
            href={o.href}
            scroll={false}
            aria-current={active ? "true" : undefined}
            onClick={() => {
              if (!active) setPending(o.key);
            }}
            className={cn(
              "inline-flex items-center whitespace-nowrap rounded-full border font-semibold transition-colors active:scale-[0.97]",
              size === "sm" ? "h-9 px-3.5 text-sm" : "h-8 px-3 text-xs",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-foreground/70 hover:bg-muted hover:text-foreground",
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
