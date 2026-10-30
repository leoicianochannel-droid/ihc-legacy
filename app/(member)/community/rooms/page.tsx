import { auth } from "@clerk/nextjs/server";
import { db, users, rooms, roomMembers } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { RoomCard } from "./room-card";

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  const { userId: clerkId } = await auth();

  let meId: string | null = null;
  if (clerkId) {
    const [me] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);
    meId = me?.id ?? null;
  }

  const allRooms = await db
    .select({
      id: rooms.id,
      slug: rooms.slug,
      name: rooms.name,
      description: rooms.description,
      emoji: rooms.emoji,
      memberCount: sql<number>`(
        SELECT COUNT(*)::int FROM room_members rm WHERE rm.room_id = ${rooms.id}
      )`,
    })
    .from(rooms)
    .where(eq(rooms.isActive, true))
    .orderBy(rooms.sortOrder);

  const myRoomIds = new Set<string>();
  if (meId) {
    const joined = await db
      .select({ roomId: roomMembers.roomId })
      .from(roomMembers)
      .where(eq(roomMembers.userId, meId));
    joined.forEach((r) => myRoomIds.add(r.roomId));
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-6 pb-28 md:pb-10">
      <div className="mb-1">
        <h1 className="text-[2rem] font-display font-extrabold tracking-tight text-gray-900">Rooms</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Topic-focused spaces. Join the ones that fit you.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {allRooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            isJoined={myRoomIds.has(room.id)}
            isLoggedIn={!!meId}
          />
        ))}
      </div>

      {allRooms.length === 0 && (
        <div className="mt-16 text-center text-muted-foreground text-sm">
          No rooms yet — check back soon.
        </div>
      )}
    </div>
  );
}
