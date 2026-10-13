import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { listInbox } from "./actions";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let inbox: Awaited<ReturnType<typeof listInbox>> = [];
  try {
    inbox = await listInbox();
  } catch (e) {
    console.error("[messages/inbox] listInbox threw:", e);
    // Show empty state rather than crashing
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-10 md:py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-4xl font-bold">Messages</h1>
      </div>

      {inbox.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageCircle className="mx-auto size-12 text-muted-foreground" />
            <p className="mt-4 font-display text-xl font-bold">No messages yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tap "Message" on any community post to start a conversation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {inbox.map((row) => {
            const name =
              `${row.otherFirstName ?? "Member"} ${(row.otherLastName ?? "").slice(0, 1)}${row.otherLastName ? "." : ""}`.trim();
            return (
              <Link
                key={row.conversationId}
                href={`/messages/${row.conversationId}`}
                className="block"
              >
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Avatar>
                      <AvatarImage src={row.otherAvatarUrl ?? undefined} />
                      <AvatarFallback>
                        {(row.otherFirstName ?? "U").slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {row.lastAt
                            ? formatDate(row.lastAt, {
                                month: "short",
                                day: "numeric",
                                year: undefined,
                              })
                            : ""}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p className="truncate text-sm text-muted-foreground">
                          {row.lastBody ?? "No messages yet"}
                        </p>
                        {row.unreadCount > 0 && (
                          <Badge className="shrink-0 bg-primary text-primary-foreground">
                            {row.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
