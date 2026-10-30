"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, rooms, roomMembers } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function requireMember() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("not authenticated");
  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) throw new Error("no user");
  return me;
}

export async function joinRoom(roomId: string): Promise<{ joined: boolean }> {
  const me = await requireMember();

  const [room] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.id, roomId), eq(rooms.isActive, true)))
    .limit(1);
  if (!room) throw new Error("Room not found");

  await db
    .insert(roomMembers)
    .values({ roomId, userId: me.id })
    .onConflictDoNothing();

  revalidatePath("/community/rooms");
  return { joined: true };
}

export async function leaveRoom(roomId: string): Promise<{ joined: boolean }> {
  const me = await requireMember();

  await db
    .delete(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, me.id)));

  revalidatePath("/community/rooms");
  return { joined: false };
}
