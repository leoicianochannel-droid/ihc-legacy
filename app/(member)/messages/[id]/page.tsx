import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { loadConversation, markRead } from "../actions";
import { ConversationThread } from "./thread";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;

  let res;
  try {
    res = await loadConversation(id);
  } catch (e) {
    console.error("[messages/id] loadConversation threw:", e);
    throw e;
  }
  if (!res.ok) {
    console.error("[messages/id] loadConversation not ok:", res.error);
    notFound();
  }

  // Mark all incoming messages as read on view
  try {
    await markRead(id);
  } catch (e) {
    // Non-fatal — don't crash the page just because read-marking failed
    console.error("[messages/id] markRead threw:", e);
  }

  const otherName =
    `${res.other.firstName ?? "Member"} ${(res.other.lastName ?? "").slice(0, 1)}${res.other.lastName ? "." : ""}`.trim();

  return (
    <div className="fixed inset-x-0 top-0 z-10 flex flex-col bg-background px-4 py-4 bottom-[calc(56px_+_env(safe-area-inset-bottom,_0px))] md:relative md:inset-auto md:bottom-auto md:z-auto md:mx-auto md:max-w-3xl md:h-[calc(100dvh-3.5rem)] md:px-10 md:py-6">
      <div className="flex items-center gap-3 border-b pb-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/messages">
            <ChevronLeft />
          </Link>
        </Button>
        <Avatar className="size-9">
          <AvatarImage src={res.other.avatarUrl ?? undefined} />
          <AvatarFallback>
            {(res.other.firstName ?? "U").slice(0, 1)}
          </AvatarFallback>
        </Avatar>
        <span className="font-semibold">{otherName}</span>
      </div>

      <ConversationThread
        conversationId={id}
        currentUserId={res.me.id}
        initialMessages={res.messages}
      />
    </div>
  );
}
