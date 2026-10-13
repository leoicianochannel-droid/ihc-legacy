"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { MessageCircle, HelpCircle, Bell, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

export function TopBar({
  unreadCount = 0,
  unreadDmCount = 0,
  giftReady = false,
}: {
  unreadCount?: number;
  unreadDmCount?: number;
  giftReady?: boolean;
}) {
  const pathname = usePathname();
  const messagesActive = pathname === "/messages" || pathname.startsWith("/messages/");
  const helpActive = pathname === "/welcome";
  const notificationsActive = pathname === "/notifications";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:justify-end md:px-6">
      {/* Logo — visible only on mobile; desktop shows it in the sidebar */}
      <Link href="/dashboard" className="mr-auto md:hidden">
        <Logo className="h-6" />
      </Link>

      {/* Gift notification — small icon, only when a gift is ready */}
      {giftReady && (
        <Link
          href="/gifts"
          aria-label="Free gift ready"
          className="relative flex size-9 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
        >
          <Gift className="size-5" />
          <span className="absolute right-1 top-1 size-2 rounded-full bg-primary" />
        </Link>
      )}

      <Link
        href="/notifications"
        aria-label="Notifications"
        className={cn(
          "relative flex size-9 items-center justify-center rounded-full transition-colors",
          notificationsActive
            ? "bg-primary/10 text-primary"
            : "text-foreground/60 hover:bg-muted hover:text-foreground"
        )}
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Link>
      <Link
        href="/messages"
        aria-label="Messages"
        className={cn(
          "relative flex size-9 items-center justify-center rounded-full transition-colors",
          messagesActive
            ? "bg-primary/10 text-primary"
            : "text-foreground/60 hover:bg-muted hover:text-foreground"
        )}
      >
        <MessageCircle className="size-5" />
        {unreadDmCount > 0 && (
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {unreadDmCount > 9 ? "9+" : unreadDmCount}
          </span>
        )}
      </Link>
      <Link
        href="/welcome"
        aria-label="Help"
        className={cn(
          "hidden size-9 items-center justify-center rounded-full transition-colors md:flex",
          helpActive
            ? "bg-primary/10 text-primary"
            : "text-foreground/60 hover:bg-muted hover:text-foreground"
        )}
      >
        <HelpCircle className="size-5" />
      </Link>
      <UserButton afterSignOutUrl="/" />
    </header>
  );
}
