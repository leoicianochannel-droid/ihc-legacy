/**
 * Server helpers for the "currently hooping" presence indicator.
 *
 * The workout player sends a heartbeat (~30s) → updates `lastPingAt`.
 * A row is "active" if its lastPingAt is within the last 2 minutes; older
 * rows are stale (browser closed without firing the explicit end event).
 */
import { db, liveSessions, users } from "./db";
import { desc, eq, sql } from "drizzle-orm";

const STALE_AFTER_SECONDS = 120;

export type LiveHooper = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  startedAt: Date;
};

/** Upsert the calling user's session — used by the heartbeat endpoint. */
export async function pingPresence(userId: string, workoutId: string | null) {
  await db
    .insert(liveSessions)
    .values({
      userId,
      workoutId,
      startedAt: new Date(),
      lastPingAt: new Date(),
    })
    .onConflictDoUpdate({
      target: liveSessions.userId,
      set: {
        workoutId,
        lastPingAt: sql`now()`,
      },
    });
}

/** End the user's session immediately (called on unmount / unload). */
export async function endPresence(userId: string) {
  await db.delete(liveSessions).where(eq(liveSessions.userId, userId));
}

/** Count + list members currently hooping (excluding the caller, optionally). */
export async function getActiveHoopers(opts: {
  excludeUserId?: string;
  limit?: number;
} = {}): Promise<{ count: number; recent: LiveHooper[] }> {
  const limit = opts.limit ?? 10;
  // Drizzle doesn't expose a clean `now() - interval`, so use raw SQL fragment
  const rows = await db
    .select({
      userId: liveSessions.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
      startedAt: liveSessions.startedAt,
    })
    .from(liveSessions)
    .innerJoin(users, eq(users.id, liveSessions.userId))
    .where(sql`${liveSessions.lastPingAt} > now() - interval '${sql.raw(String(STALE_AFTER_SECONDS))} seconds'`)
    .orderBy(desc(liveSessions.startedAt))
    .limit(limit);

  const filtered = opts.excludeUserId
    ? rows.filter((r) => r.userId !== opts.excludeUserId)
    : rows;

  return { count: filtered.length, recent: filtered };
}
