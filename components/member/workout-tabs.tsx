"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Droplets, Flame, PlayCircle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/workouts", label: "Single Sessions", short: "Sessions", icon: PlayCircle },
  { href: "/challenges", label: "Challenges", short: "Challenges", icon: Trophy },
  { href: "/workouts/75", label: "IH 75", short: "IH 75", icon: Flame },
  { href: "/workouts/lymphatic", label: "Lymphatic Flow", short: "Lymphatic", icon: Droplets },
] as const;

function tabForPath(pathname: string): string {
  if (pathname.startsWith("/workouts/75")) return "/workouts/75";
  if (pathname.startsWith("/workouts/lymphatic")) return "/workouts/lymphatic";
  if (pathname.startsWith("/challenges")) return "/challenges";
  return "/workouts";
}

/**
 * The one section switcher for Workouts: an iOS-style segmented control with
 * the same four segments on every section page. Always fits the screen
 * (short labels on phones), and the tapped segment lights up immediately,
 * before the next page has loaded.
 */
export function WorkoutTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const [pending, setPending] = useState<string | null>(null);

  // Once navigation lands, the URL is the source of truth again.
  useEffect(() => setPending(null), [pathname]);

  const active = pending ?? tabForPath(pathname);

  return (
    <nav
      aria-label="Workout sections"
      className={cn("grid w-full max-w-2xl grid-cols-4 gap-1 rounded-full bg-muted p-1", className)}
    >
      {TABS.map(({ href, label, short, icon: Icon }) => {
        const isActive = href === active;
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            onClick={() => {
              if (!isActive) setPending(href);
            }}
            className={cn(
              "flex h-9 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-1 text-xs font-semibold transition-all min-[360px]:text-[13px] sm:h-10 sm:text-sm",
              isActive
                ? "bg-background text-primary shadow-sm"
                : "text-foreground/60 hover:text-foreground active:scale-[0.97]",
            )}
          >
            <Icon className="hidden size-4 shrink-0 sm:block" />
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
