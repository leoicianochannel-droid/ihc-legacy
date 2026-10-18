"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { Logo } from "@/components/logo";
import {
  Home,
  PlayCircle,
  Salad,
  Trophy,
  Users,
  LineChart,
  Settings,
  ShoppingCart,
  Shield,
  Sparkles,
  HelpCircle,
  Gift,
  MessageCircle,
  MoreHorizontal,
  X,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  MapPin,
  LogOut,
  Tag,
  PartyPopper,
  UserPlus,
  Dumbbell,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SubItem = { href: string; label: string };
type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  accent?: boolean;
  children?: SubItem[];
};

// Order is "primary first" — the first 4 are pinned to the mobile bottom nav.
// Everything past that lives behind the "More" sheet.
const NAV: NavItem[] = [
  { href: "/dashboard", label: "Today", icon: Home },
  { href: "/plan", label: "My Plan", icon: MapPin, accent: true },
  {
    href: "/workouts",
    label: "Workouts",
    icon: PlayCircle,
    children: [
      { href: "/workouts", label: "Single Sessions" },
      { href: "/challenges", label: "Challenges" },
      { href: "/workouts/75", label: "IH 75" },
      { href: "/workouts/lymphatic", label: "Lymphatic Flow" },
    ],
  },
  {
    href: "/community",
    label: "Community",
    icon: Users,
    children: [
      { href: "/community", label: "Feed" },
      { href: "/community/members", label: "Members" },
      { href: "/community/buddy", label: "Accountability Buddy" },
    ],
  },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/activity", label: "Log a Workout", icon: Dumbbell },
  {
    href: "/recipes",
    label: "Recipes",
    icon: Salad,
    children: [
      { href: "/recipes", label: "Recipes" },
      { href: "/grocery", label: "Grocery" },
    ],
  },
  { href: "/welcome", label: "Help", icon: HelpCircle },
  { href: "/gifts", label: "Free Gifts", icon: PartyPopper, accent: true },
  { href: "/perks", label: "Member Perks", icon: Tag, accent: true },
  { href: "/rewards", label: "Rewards", icon: Gift, accent: true },
  { href: "/invite", label: "Invite a Friend", icon: UserPlus },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MOBILE_PRIMARY_COUNT = 4; // first 4 always visible in the bottom nav

// The mobile "More" sheet, as an iOS-style grouped list.
type SheetRow = { href: string; label: string; icon: typeof Home };
const MORE_SECTIONS: { title: string; rows: SheetRow[] }[] = [
  {
    title: "You",
    rows: [
      { href: "/messages", label: "Messages", icon: MessageCircle },
      { href: "/progress", label: "Progress", icon: LineChart },
      { href: "/activity", label: "Log a Workout", icon: Dumbbell },
    ],
  },
  {
    title: "Food",
    rows: [
      { href: "/recipes", label: "Recipes", icon: Salad },
      { href: "/grocery", label: "Grocery List", icon: ShoppingCart },
    ],
  },
  {
    title: "Perks",
    rows: [
      { href: "/gifts", label: "Free Gifts", icon: PartyPopper },
      { href: "/perks", label: "Member Perks", icon: Tag },
      { href: "/rewards", label: "Rewards", icon: Gift },
      { href: "/invite", label: "Invite a Friend", icon: UserPlus },
    ],
  },
  {
    title: "Account",
    rows: [
      { href: "/welcome", label: "Help", icon: HelpCircle },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function MemberSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();
  const [moreOpen, setMoreOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  // Persist collapsed state across page navigations
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  // Auto-expand any nav item whose children include the active route.
  const initialOpen = NAV.reduce<Record<string, boolean>>((acc, item) => {
    if (item.children) {
      const childActive = item.children.some(
        (c) => pathname === c.href || pathname.startsWith(c.href + "/")
      );
      if (childActive) acc[item.href] = true;
    }
    return acc;
  }, {});
  const [openItems, setOpenItems] = useState<Record<string, boolean>>(initialOpen);

  const toggleItem = (href: string) =>
    setOpenItems((prev) => ({ ...prev, [href]: !prev[href] }));

  // Close the "More" sheet when the route changes
  const closeMore = () => setMoreOpen(false);

  const primary = NAV.slice(0, MOBILE_PRIMARY_COUNT);

  // True when the active route lives behind the More sheet — used to highlight
  // the More button so it never feels like the user "lost" their location.
  const isCurrent = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const moreActive =
    MORE_SECTIONS.some((sec) => sec.rows.some((r) => isCurrent(r.href))) ||
    (isAdmin && pathname.startsWith("/admin"));

  // Escape closes the sheet; the page behind it doesn't scroll while open.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  return (
    <>
      {/* ─────────────────── Desktop sidebar ─────────────────── */}
      <aside className={cn(
        "hidden shrink-0 border-r border-gray-100 bg-white transition-all duration-200 md:flex md:flex-col",
        collapsed ? "w-16" : "w-64"
      )}>
        {/* Header: logo + collapse toggle */}
        <div className="flex h-16 items-center border-b border-gray-100 px-3">
          {!collapsed && (
            <Link href="/dashboard" className="flex-1 pl-2">
              <Logo className="h-7" />
            </Link>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex size-9 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700",
              collapsed && "mx-auto"
            )}
          >
            {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-2">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const childActive = item.children?.some(
              (c) => pathname === c.href || pathname.startsWith(c.href + "/")
            );
            const isExpanded = !!openItems[item.href];
            const isAccent = !!item.accent;

            // Collapsed: icon-only buttons with tooltip
            if (collapsed) {
              const isHighlighted = active || !!childActive;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={cn(
                    "flex w-full items-center justify-center rounded-xl p-2.5 transition-all",
                    isHighlighted
                      ? isAccent
                        ? "bg-primary text-white"
                        : "bg-primary/10 text-primary"
                      : isAccent
                      ? "text-primary hover:bg-primary/10"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <item.icon className="size-5" />
                </Link>
              );
            }

            // Expanded: full labels + dropdowns
            if (item.children) {
              return (
                <div key={item.href}>
                  <button
                    type="button"
                    onClick={() => toggleItem(item.href)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
                      childActive
                        ? "bg-primary/10 text-primary"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <item.icon className="size-5 shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 transition-transform duration-200",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </button>
                  {isExpanded && (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l pl-3">
                      {item.children.map((child) => {
                        const childCurrent =
                          pathname === child.href ||
                          pathname.startsWith(child.href + "/");
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "block rounded-lg px-3 py-2 text-sm font-semibold transition-all",
                              childCurrent
                                ? "bg-primary/10 text-primary"
                                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                            )}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
                  active
                    ? isAccent
                      ? "bg-primary text-white"
                      : "bg-primary/10 text-primary"
                    : isAccent
                    ? "text-primary hover:bg-primary/10"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <>
              <div className="my-3 border-t" />
              {collapsed ? (
                <Link
                  href="/admin"
                  title="Admin"
                  className={cn(
                    "flex w-full items-center justify-center rounded-xl p-2.5 transition-all",
                    pathname.startsWith("/admin")
                      ? "bg-foreground text-background"
                      : "text-foreground/70 hover:bg-foreground hover:text-background"
                  )}
                >
                  <Shield className="size-5" />
                </Link>
              ) : (
                <Link
                  href="/admin"
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-display font-semibold transition-all",
                    pathname.startsWith("/admin")
                      ? "bg-foreground text-background"
                      : "text-foreground/70 hover:bg-foreground hover:text-background"
                  )}
                >
                  <Shield className="size-5" />
                  Admin
                </Link>
              )}
            </>
          )}
        </nav>

        {/* Sign out — pinned to sidebar bottom */}
        <div className="border-t border-gray-100 p-2">
          {collapsed ? (
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out"
              className="flex w-full items-center justify-center rounded-xl p-2.5 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
            >
              <LogOut className="size-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
            >
              <LogOut className="size-5" />
              Sign out
            </button>
          )}
        </div>
      </aside>

      {/* ─────────────────── Mobile bottom nav ─────────────────── */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-gray-100 bg-white md:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
      >
        {primary.map((item) => {
          const active =
            pathname === item.href ||
            pathname.startsWith(item.href + "/") ||
            !!item.children?.some(
              (c) => pathname === c.href || pathname.startsWith(c.href + "/")
            );
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors",
                active ? "text-primary" : "text-gray-400"
              )}
            >
              <item.icon className="size-[22px]" />
              <span className="text-[10px] font-semibold tracking-tight">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="More navigation"
          className={cn(
            "flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors",
            moreActive ? "text-primary" : "text-gray-400"
          )}
        >
          <MoreHorizontal className="size-[22px]" />
          <span className="text-[10px] font-semibold tracking-tight">More</span>
        </button>
      </nav>

      {/* ─────────────────── Mobile "More" bottom sheet ─────────────────── */}
      {moreOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="More"
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 animate-in fade-in duration-200 md:hidden"
          onClick={closeMore}
        >
          <div
            className="flex max-h-[88dvh] flex-col rounded-t-3xl bg-gray-100 shadow-2xl animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle + title */}
            <div className="shrink-0 px-4 pb-2 pt-2">
              <div className="mx-auto h-1 w-10 rounded-full bg-gray-300" />
              <div className="mt-3 flex items-center justify-between">
                <h2 className="font-display text-2xl font-bold">More</h2>
                <button
                  type="button"
                  onClick={closeMore}
                  aria-label="Close"
                  className="flex size-8 items-center justify-center rounded-full bg-gray-200 text-gray-600 active:bg-gray-300"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div
              className="overflow-y-auto overscroll-contain px-4"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
            >
              {[
                ...MORE_SECTIONS,
                ...(isAdmin
                  ? [{ title: "Team", rows: [{ href: "/admin", label: "Admin", icon: Shield }] }]
                  : []),
              ].map((section) => (
                <section key={section.title} className="mt-4 first:mt-2">
                  <h3 className="mb-1.5 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {section.title}
                  </h3>
                  <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white">
                    {section.rows.map((row) => {
                      const current = isCurrent(row.href);
                      return (
                        <li key={row.href}>
                          <Link
                            href={row.href}
                            onClick={closeMore}
                            aria-current={current ? "page" : undefined}
                            className="flex min-h-[50px] items-center gap-3 px-4 active:bg-gray-50"
                          >
                            <span
                              className={cn(
                                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                                current ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                              )}
                            >
                              <row.icon className="size-[18px]" />
                            </span>
                            <span className={cn("flex-1 text-[15px]", current ? "font-semibold text-primary" : "text-foreground")}>
                              {row.label}
                            </span>
                            <ChevronRight className="size-4 shrink-0 text-gray-300" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              <button
                type="button"
                onClick={handleSignOut}
                className="mt-6 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-semibold text-red-600 active:bg-gray-50"
              >
                <LogOut className="size-[18px]" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
