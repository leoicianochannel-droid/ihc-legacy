"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { joinRoom, leaveRoom } from "../actions";

export function RoomJoinButton({
  roomId,
  initialJoined,
}: {
  roomId: string;
  initialJoined: boolean;
}) {
  const [joined, setJoined] = useState(initialJoined);
  const [pending, start] = useTransition();

  function toggle() {
    start(async () => {
      if (joined) {
        await leaveRoom(roomId);
        setJoined(false);
      } else {
        await joinRoom(roomId);
        setJoined(true);
      }
    });
  }

  return (
    <Button
      variant={joined ? "outline" : "gradient"}
      size="sm"
      disabled={pending}
      onClick={toggle}
    >
      {pending ? "…" : joined ? "Joined ✓" : "Join room"}
    </Button>
  );
}
