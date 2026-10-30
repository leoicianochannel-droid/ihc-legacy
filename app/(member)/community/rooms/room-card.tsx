"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { joinRoom, leaveRoom } from "./actions";
import { Users } from "lucide-react";

type RoomInfo = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  emoji: string;
  memberCount: number;
};

export function RoomCard({
  room,
  isJoined,
  isLoggedIn,
}: {
  room: RoomInfo;
  isJoined: boolean;
  isLoggedIn: boolean;
}) {
  const [pending, start] = useTransition();

  function toggle() {
    if (!isLoggedIn) return;
    start(async () => {
      if (isJoined) {
        await leaveRoom(room.id);
      } else {
        await joinRoom(room.id);
      }
    });
  }

  return (
    <div className="relative flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:border-primary/30 hover:shadow-md transition-all">
      <Link href={`/community/rooms/${room.slug}`} className="absolute inset-0 rounded-2xl" aria-label={`Open ${room.name} room`} />
      <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-3xl">
        {room.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold text-gray-900">{room.name}</p>
        {room.description && (
          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{room.description}</p>
        )}
        <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="size-3" />
          <span>{room.memberCount.toLocaleString()} member{room.memberCount !== 1 ? "s" : ""}</span>
        </div>
      </div>
      {isLoggedIn && (
        <Button
          variant={isJoined ? "outline" : "gradient"}
          size="sm"
          disabled={pending}
          onClick={(e) => { e.preventDefault(); toggle(); }}
          className="relative z-10 shrink-0"
        >
          {pending ? "…" : isJoined ? "Leave" : "Join"}
        </Button>
      )}
    </div>
  );
}
