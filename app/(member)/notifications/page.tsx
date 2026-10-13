import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db, users, notifications } from "@/lib/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, MessageSquare, AtSign, Zap, Trophy, CreditCard, Info } from "lucide-react";
import { PushPromptBanner } from "@/components/pwa/push-prompt-banner";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ICONS: Record<string, React.ReactNode> = {
  post_reply: <MessageSquare className="size-4" />,
  mention: <AtSign className="size-4" />,
  streak_risk: <Zap className="size-4" />,
  buddy_checkin: <MessageSquare className="size-4" />,
  challenge_starting: <Trophy className="size-4" />,
  milestone_reached: <Trophy className="size-4" />,
  billing: <CreditCard className="size-4" />,
  system: <Info className="size-4" />,
};

function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function NotificationsPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const [me] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) redirect("/onboarding");

  const items = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, me.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  // Mark all unread as read
  const unreadIds = items.filter((n) => !n.readAt).map((n) => n.id);
  if (unreadIds.length > 0) {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, me.id), isNull(notifications.readAt)))
      .catch(() => {});
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-10 md:py-8">
      <PushPromptBanner />
      <div className="mb-6 flex items-center gap-3">
        <Bell className="size-6 text-primary" />
        <h1 className="font-display text-3xl font-bold">Notifications</h1>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Bell className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-4 font-display text-xl font-bold">All caught up!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You'll see comments, mentions, and updates here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const isUnread = !n.readAt || unreadIds.includes(n.id);
            const inner = (
              <div
                className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${
                  isUnread
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${isUnread ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {ICONS[n.type] ?? <Bell className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${isUnread ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                  {n.body && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                </div>
                {isUnread && (
                  <div className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                )}
              </div>
            );

            return n.actionUrl ? (
              <Link key={n.id} href={n.actionUrl}>
                {inner}
              </Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
