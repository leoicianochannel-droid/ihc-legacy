import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db, users, buddyMatches, conversations, messages } from "@/lib/db";
import { eq, or, and, asc } from "drizzle-orm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Heart,
  Sparkles,
  Clock,
  MessageCircle,
  ArrowRight,
  Users,
  Trophy,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { relativeTime } from "@/lib/utils";
import { BuddyCheckin } from "./buddy-checkin";
import { RematchButton } from "./rematch-button";
import { LeaveMatchButton } from "./leave-match-button";
import { RequestNewBuddyButton } from "./request-new-buddy-button";
import { findOrCreateConversation } from "@/app/(member)/messages/actions";

export const dynamic = "force-dynamic";

export default async function BuddyPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) redirect("/onboarding");

  // Active buddy match
  const [activeMatch] = await db
    .select({ m: buddyMatches, b: users })
    .from(buddyMatches)
    .leftJoin(
      users,
      or(
        and(eq(buddyMatches.userAId, me.id), eq(users.id, buddyMatches.userBId)),
        and(eq(buddyMatches.userBId, me.id), eq(users.id, buddyMatches.userAId))
      )
    )
    .where(
      and(
        or(eq(buddyMatches.userAId, me.id), eq(buddyMatches.userBId, me.id)),
        eq(buddyMatches.status, "active")
      )
    )
    .limit(1);

  const buddy = activeMatch?.b ?? null;

  // If matched, find/create the conversation and load recent messages
  let conversationId: string | null = null;
  let recentMessages: Array<{ id: string; body: string; senderId: string; createdAt: Date }> = [];

  if (buddy) {
    try {
      conversationId = await findOrCreateConversation(buddy.id);

      if (conversationId) {
        const [minId, maxId] =
          me.id < buddy.id ? [me.id, buddy.id] : [buddy.id, me.id];
        const [conv] = await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(
            and(eq(conversations.userMinId, minId), eq(conversations.userMaxId, maxId))
          )
          .limit(1);

        if (conv) {
          recentMessages = await db
            .select({
              id: messages.id,
              body: messages.body,
              senderId: messages.senderId,
              createdAt: messages.createdAt,
            })
            .from(messages)
            .where(eq(messages.conversationId, conv.id))
            .orderBy(asc(messages.createdAt))
            .limit(4);
        }
      }
    } catch {
      // Non-fatal — page still renders without messages
    }
  }

  const lastMessage = recentMessages.at(-1);
  const lastCheckinAt = activeMatch?.m.lastCheckInAt ?? lastMessage?.createdAt ?? null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-10 md:py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold md:text-4xl">Accountability Buddy</h1>
        <p className="mt-1 text-muted-foreground">
          Someone in your corner — matched on your schedule, goals, and vibe.
        </p>
      </div>

      {buddy ? (
        <div className="space-y-4">

          {/* ── Buddy profile card ── */}
          <Card className="overflow-hidden border-primary/20">
            <div className="bg-primary/5 px-5 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="size-16 ring-2 ring-primary/20">
                  <AvatarImage src={buddy.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-primary/10 font-display text-2xl font-bold text-primary">
                    {buddy.firstName?.slice(0, 1) ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-display text-xl font-bold leading-tight">
                      {buddy.firstName} {buddy.lastName?.slice(0, 1)}{buddy.lastName ? "." : ""}
                    </span>
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-none text-[10px] shrink-0">
                      <Heart className="mr-1 size-2.5 fill-current" /> Your buddy
                    </Badge>
                  </div>
                  {activeMatch?.m.matchReason && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      <Sparkles className="inline size-3 text-primary" />{" "}
                      {activeMatch.m.matchReason}
                    </p>
                  )}
                  {lastCheckinAt && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Last check-in {relativeTime(lastCheckinAt)}
                    </p>
                  )}
                  {conversationId && (
                    <Link
                      href={`/messages/${conversationId}`}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      <MessageCircle className="size-3.5" />
                      Message {buddy.firstName ?? "buddy"}
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Recent messages preview */}
            {conversationId && (
              <div className="border-t px-5 py-3">
                {recentMessages.length > 0 ? (
                  <>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Recent messages
                    </p>
                    <div className="space-y-1.5">
                      {recentMessages.slice(-3).map((msg) => {
                        const isMe = msg.senderId === me.id;
                        return (
                          <div key={msg.id} className={`flex gap-2 text-sm ${isMe ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                              {msg.body}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl bg-muted/40 p-3 text-center">
                    <p className="text-sm font-semibold">You haven't said hi yet! 👋</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Tap below to break the ice — your buddy is waiting.</p>
                  </div>
                )}
                <Link
                  href={`/messages/${conversationId}`}
                  className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Open full conversation <ArrowRight className="size-3" />
                </Link>
              </div>
            )}

            {/* Check-in form — only when conversation is available */}
            {conversationId && (
              <div className="border-t px-5 py-4">
                <BuddyCheckin
                  conversationId={conversationId}
                  buddyFirstName={buddy.firstName}
                />
              </div>
            )}
          </Card>

          {/* ── Tips card ── */}
          <Card>
            <CardContent className="p-5">
              <p className="font-display font-bold">Tips for a great buddy relationship</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-base">📅</span>
                  <span><strong className="text-foreground">Check in at least once a week</strong> — even a quick "how's it going?" keeps the momentum going.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-base">🏆</span>
                  <span><strong className="text-foreground">Celebrate every win</strong> — big or small. Your encouragement means more than you think.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-base">💬</span>
                  <span><strong className="text-foreground">Be honest</strong> — tell them when you're struggling. That's what they're here for.</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <div className="rounded-2xl border border-dashed p-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">Not connecting with your buddy?</p>
            <RequestNewBuddyButton />
          </div>

          <div className="mt-2 text-center">
            <LeaveMatchButton />
          </div>

        </div>
      ) : (
        /* ── Unmatched state ── */
        <div className="space-y-4">
          <Card>
            <CardContent className="py-10 text-center">
              {!me.onboardedAt && !me.migratedFromSkool ? (
                <>
                  <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
                    <Users className="size-8 text-primary" />
                  </div>
                  <h2 className="font-display text-xl font-bold">Complete your profile to get matched</h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                    We use your goals, schedule, and fitness level to find someone who's a great fit for you.
                  </p>
                  <div className="mt-5">
                    <Link
                      href="/onboarding"
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      <Zap className="size-4" /> Set up my profile
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
                    <Clock className="size-8 text-primary animate-pulse" />
                  </div>
                  <h2 className="font-display text-xl font-bold">Finding your perfect match…</h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                    We're pairing you with someone who shares your schedule, fitness level, and vibe.
                  </p>
                  <div className="mt-5">
                    <RematchButton />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* What is a buddy? */}
          <Card>
            <CardContent className="p-5">
              <p className="font-display text-base font-bold">What is an accountability buddy?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                A real member just like you — someone to check in with, celebrate wins together, and
                keep each other on track when motivation is low.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
                {[
                  { icon: Users, label: "Personally matched", sub: "Based on your goals & schedule" },
                  { icon: MessageCircle, label: "Private messages", sub: "Just the two of you" },
                  { icon: Trophy, label: "Celebrate wins", sub: "Together, every step" },
                ].map(({ icon: Icon, label, sub }) => (
                  <div key={label} className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3 sm:flex-col sm:items-center sm:gap-1">
                    <Icon className="size-5 shrink-0 text-primary sm:mx-auto sm:mb-0.5" />
                    <div className="text-left sm:text-center">
                      <p className="text-xs font-bold leading-tight sm:text-[11px]">{label}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight sm:text-[10px]">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="flex items-center gap-3 p-4">
              <Zap className="size-5 shrink-0 text-amber-500" />
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Pro tip:</strong> Members with accountability
                buddies are 3× more likely to complete their 8-week plan.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
