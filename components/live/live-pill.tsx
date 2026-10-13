"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type LiveHooper = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

const POLL_MS = 30_000;

/**
 * "🔴 X hooping now" pill. Polls /api/live/active every 30 seconds, hides
 * itself when nobody's active.
 *
 * `variant="row"` shows the pill with a stacked avatar row — used on the
 * dashboard hero. `variant="compact"` is just the count + dot, suitable for
 * inline placement (e.g. community page header).
 */
export function LivePill({
  variant = "compact",
  className,
}: {
  variant?: "compact" | "row";
  className?: string;
}) {
  const [count, setCount] = useState<number>(0);
  const [recent, setRecent] = useState<LiveHooper[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/live/active", { cache: "no-store" });
        if (!res.ok) return;
        const data: { count: number; recent: LiveHooper[] } = await res.json();
        if (cancelled) return;
        setCount(data.count);
        setRecent(data.recent);
        setLoaded(true);
      } catch {}
    };
    tick();
    const handle = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, []);

  if (!loaded || count === 0) return null;

  if (variant === "compact") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700",
          className
        )}
        title={`${count} member${count === 1 ? "" : "s"} hooping right now`}
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-rose-500" />
        </span>
        {count} hooping now
      </span>
    );
  }

  // ── Row variant ──
  const avatars = recent.slice(0, 4);
  const more = Math.max(0, count - avatars.length);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5",
        className
      )}
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-rose-500" />
      </span>
      <div className="-space-x-2 flex">
        {avatars.map((u) => (
          <Avatar
            key={u.userId}
            className="size-6 border-2 border-rose-50"
            title={`${u.firstName ?? "Member"} ${(u.lastName ?? "").slice(0, 1)}`}
          >
            <AvatarImage src={u.avatarUrl ?? undefined} />
            <AvatarFallback className="text-[10px]">
              {(u.firstName ?? "U").slice(0, 1)}
            </AvatarFallback>
          </Avatar>
        ))}
        {more > 0 && (
          <span className="flex size-6 items-center justify-center rounded-full border-2 border-rose-50 bg-rose-200 text-[10px] font-bold text-rose-800">
            +{more}
          </span>
        )}
      </div>
      <span className="text-xs font-semibold text-rose-700">
        {count} hooping now
      </span>
    </div>
  );
}
