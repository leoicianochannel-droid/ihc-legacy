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
  { href: "/activity", label: "Log My Workout", icon: Dumbbell },
  {
    href: "/recipes",
    label: "Recipes",
    icon: Salad,
    children: [
      { href: "/recipes", label: "Recipes" },
      { href: "/grocery", label: "Grocery" },
    ],
  },
  { href: "/welcome", label: "Welcome / Help", icon: HelpCircle },
  { href: "/gifts", label: "Free Gifts", icon: PartyPopper, accent: true },
  { href: "/perks", label: "Member Perks", icon: Tag, accent: true },
  { href: "/rewards", label: "Rewards", icon: Gift, accent: true },
  { href: "/invite", label: "Invite a Friend", icon: UserPlus },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MOBILE_PRIMARY_COUNT = 4; // first 4 always visible in the bottom nav

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
  const overflow = NAV.slice(MOBILE_PRIMARY_COUNT);

  // True when the active route lives behind the More sheet — used to highlight
  // the More button so it never feels like the user "lost" their location.
  const moreActive = overflow.some(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/")
  );

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
          aria-label="More navigation"
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm md:hidden"
          onClick={closeMore}
        >
          <div
            className="rounded-t-3xl border-t border-gray-100 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{
              paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2">
              <div className="h-1 w-10 rounded-full bg-muted" />
            </div>
            <div className="flex items-center justify-between px-5 pb-2 pt-3">
              <h2 className="font-display text-lg font-bold">More</h2>
              <button
                type="button"
                onClick={closeMore}
                aria-label="Close"
                className="flex size-9 items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 pb-2 sm:grid-cols-3">
              {overflow.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const childActive = item.children?.some(
                  (c) => pathname === c.href || pathname.startsWith(c.href + "/")
                );
                const isAccent = !!item.accent;

                // Items with children expand inline to show sub-items
                if (item.children) {
                  return (
                    <div key={item.href} className="col-span-2 sm:col-span-3">
                      <button
                        type="button"
                        onClick={() => toggleItem(item.href)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-xs font-display font-semibold transition-colors",
                          childActive
                            ? "border-primary bg-primary/10 text-primary"
                            : "text-foreground/80"
                        )}
                      >
                        <item.icon className="size-5 shrink-0" />
                        <span className="flex-1 text-left text-sm font-display">{item.label}</span>
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 transition-transform duration-200",
                            openItems[item.href] && "rotate-180"
                          )}
                        />
                      </button>
                      {openItems[item.href] && (
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          {item.children.map((child) => {
                            const childCurrent =
                              pathname === child.href ||
                              pathname.startsWith(child.href + "/");
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={closeMore}
                                className={cn(
                                  "flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-xs font-display font-semibold transition-colors",
                                  childCurrent
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "text-foreground/80"
                                )}
                              >
                                <span className="text-center leading-tight">{child.label}</span>
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
                    onClick={closeMore}
                    className={cn(
                      "flex min-h-[80px] flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-xs font-display font-semibold transition-colors",
                      active
                        ? isAccent
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-primary bg-primary/10 text-primary"
                        : isAccent
                        ? "border-primary/30 bg-primary/5 text-primary"
                        : "text-foreground/80"
                    )}
                  >
                    <item.icon className="size-5" />
                    <span className="text-center leading-tight">{item.label}</span>
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={closeMore}
                  className={cn(
                    "flex min-h-[80px] flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-xs font-display font-semibold transition-colors",
                    pathname.startsWith("/admin")
                      ? "border-foreground bg-foreground text-background"
                      : "text-foreground/80"
                  )}
                >
                  <Shield className="size-5" />
                  <span>Admin</span>
                </Link>
              )}
              {/* Sign out */}
              <button
                type="button"
                onClick={handleSignOut}
                className="col-span-2 mt-1 flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-display font-semibold text-foreground/60 transition-colors hover:bg-muted hover:text-foreground sm:col-span-3"
              >
                <LogOut className="size-5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
