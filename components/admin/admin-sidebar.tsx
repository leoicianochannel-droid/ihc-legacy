"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import {
  LayoutDashboard,
  Users,
  Library,
  BarChart3,
  Sparkles,
  ShieldCheck,
  Settings,
  ArrowUpRight,
  GraduationCap,
  LogOut,
  Eye,
  Plug,
  Gift,
  Trophy,
  PackageCheck,
  TrendingDown,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; icon: typeof Users; exact?: boolean }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/members", label: "Members", icon: Users },
  { href: "/admin/content", label: "Content", icon: Library },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/retention", label: "Churn Risk", icon: TrendingDown },
  { href: "/admin/weekly-summary", label: "Weekly Summary", icon: ClipboardList },
  { href: "/admin/beta", label: "Beta Testers", icon: Sparkles },
  { href: "/admin/invites", label: "Admin Invites", icon: ShieldCheck },
  { href: "/admin/migrate", label: "Migrate", icon: ArrowUpRight },
  { href: "/admin/gifts", label: "Gifts", icon: Gift, exact: true },
  { href: "/admin/gifts/progress", label: "Gift Progress", icon: PackageCheck },
  { href: "/admin/challenges/analytics", label: "Challenge Stats", icon: BarChart3 },
  { href: "/admin/challenges/submissions", label: "Challenge Entries", icon: Trophy },
  { href: "/admin/challenges/rewards", label: "Challenge Rewards", icon: Gift },
  { href: "/admin/welcome-video", label: "Welcome Tour", icon: GraduationCap },
  { href: "/admin/webhooks", label: "Integrations", icon: Plug },
];

/**
 * Polished sidebar navigation for the admin section. Rounded-pill active
 * states, prominent "View as User" CTA at the bottom — matches the visual
 * language of modern operations dashboards.
 */
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-background md:flex md:flex-col">
      <div className="flex h-20 items-center px-6">
        <Logo className="h-7" />
        <span className="ml-3 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">
          ADMIN
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition-all",
                active
                  ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                  : "text-foreground/65 hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
              {active && (
                <span
                  aria-hidden
                  className="ml-auto inline-block size-1.5 rounded-full bg-primary"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom block — "View as User" + sign out */}
      <div className="space-y-2 border-t p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-full border-2 border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:border-primary hover:bg-primary/10"
        >
          <Eye className="size-4" /> View as User
        </Link>
        <Link
          href="/settings"
          className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
        >
          <Settings className="size-3.5" /> Settings
        </Link>
      </div>
    </aside>
  );
}
