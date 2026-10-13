/**
 * Buddy matching algorithm
 *
 * Score factors (0..1 each, weighted):
 *  - Age bucket similarity (0.20)
 *  - Fitness level match (0.15)
 *  - Movement timing keyword overlap (0.20)
 *  - Ideal-buddy-words semantic overlap (0.20)  — uses token overlap as a stand-in
 *  - Check-in style match (0.15)
 *  - Timezone proximity (0.10)
 *
 * Returns sorted candidates. Intentionally simple — runs on the DB, no ML needed.
 * Phase 3: upgrade to embedding-based similarity via OpenAI.
 */

import { db, users, buddyMatches, conversations, messages, type User } from "./db";
import { and, eq, ne, not, or, isNull, isNotNull, inArray, lt, sql } from "drizzle-orm";
import { createNotification } from "./notifications";

const MATCHABLE_ROLES: Array<"member" | "admin" | "coach"> = ["member", "admin", "coach"];

/** Members eligible for matching: must have logged in (clerkId) and completed onboarding. */
const ACTIVE_MEMBER_FILTER = and(
  inArray(users.role, MATCHABLE_ROLES),
  isNotNull(users.clerkId),
  or(isNotNull(users.onboardedAt), eq(users.migratedFromSkool, true))
);

/** Create or find the 1:1 conversation for a matched pair so it's ready to use. */
async function kickoffConversation(userAId: string, userBId: string) {
  const [minId, maxId] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];

  const [existing] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.userMinId, minId), eq(conversations.userMaxId, maxId)))
    .limit(1);

  if (!existing) {
    await db
      .insert(conversations)
      .values({ userMinId: minId, userMaxId: maxId });
  }
}

function ageBucket(age: number | null) {
  if (!age) return "unknown";
  if (age < 30) return "20s";
  if (age < 40) return "30s";
  if (age < 50) return "40s";
  if (age < 60) return "50s";
  return "60plus";
}

function tokens(s: string | null): Set<string> {
  if (!s) return new Set();
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (a.size === 0 && b.size === 0) return 0;
  const intersection = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

export function scorePair(u: User, c: User): { score: number; reason: string } {
  let s = 0;
  const reasons: string[] = [];

  if (ageBucket(u.age) === ageBucket(c.age) && u.age && c.age) {
    s += 0.2;
    reasons.push(`both in your ${ageBucket(u.age).replace("plus", "+")}`);
  }
  if (u.fitnessLevel && u.fitnessLevel === c.fitnessLevel) {
    s += 0.15;
    reasons.push(`both ${u.fitnessLevel}`);
  }
  const timing = jaccard(tokens(u.movementTiming), tokens(c.movementTiming));
  s += timing * 0.2;
  if (timing > 0.3) reasons.push("similar schedule");

  const buddyWords = jaccard(tokens(u.idealBuddyWords), tokens(c.idealBuddyWords));
  s += buddyWords * 0.2;
  if (buddyWords > 0.3) reasons.push("shared vibe");

  if (u.checkInStyle && u.checkInStyle === c.checkInStyle) {
    s += 0.15;
    reasons.push(`both prefer ${u.checkInStyle} check-ins`);
  }
  if (u.timezone && u.timezone === c.timezone) {
    s += 0.1;
    reasons.push("same timezone");
  }

  return { score: Math.min(s, 1), reason: reasons.slice(0, 3).join(", ") };
}

/** Find the top N candidate buddies for a given user. */
export async function findCandidates(userId: string, limit = 5) {
  const [me] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!me) return [];

  // Users already matched with me
  const existing = await db
    .select({ a: buddyMatches.userAId, b: buddyMatches.userBId })
    .from(buddyMatches)
    .where(or(eq(buddyMatches.userAId, userId), eq(buddyMatches.userBId, userId)));
  const excludeIds = new Set<string>([userId, ...existing.flatMap((e) => [e.a, e.b])]);

  const pool = await db
    .select()
    .from(users)
    .where(ACTIVE_MEMBER_FILTER);

  const scored = pool
    .filter((p) => !excludeIds.has(p.id))
    .map((p) => ({ user: p, ...scorePair(me, p) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

/** Create a buddy match (status pending) — other party accepts to activate. */
export async function proposeMatch(userAId: string, userBId: string) {
  const { score, reason } = scorePair(
    (await db.select().from(users).where(eq(users.id, userAId)).limit(1))[0],
    (await db.select().from(users).where(eq(users.id, userBId)).limit(1))[0]
  );
  return db
    .insert(buddyMatches)
    .values({
      userAId,
      userBId,
      status: "pending",
      matchScore: score,
      matchReason: reason,
    })
    .returning();
}

/**
 * Greedily pair ALL currently-unmatched members at once.
 * Iterates the unmatched pool in order and gives each person the best available
 * partner remaining. Returns the number of new matches created.
 *
 * Call this:
 *  - After every onboarding (so a new signup can unlock waiting members)
 *  - From the buddy page "Find me a match" button
 *  - From the admin panel
 */
export async function runBulkMatch(): Promise<number> {
  // Cancel pending matches older than 7 days — they were never accepted and
  // are blocking both members from being re-matched.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await db
    .update(buddyMatches)
    .set({ status: "ended" })
    .where(and(eq(buddyMatches.status, "pending"), lt(buddyMatches.pairedAt, sevenDaysAgo)));

  // Only exclude members who already have an ACTIVE match
  const existing = await db
    .select({ a: buddyMatches.userAId, b: buddyMatches.userBId })
    .from(buddyMatches)
    .where(eq(buddyMatches.status, "active"));
  const alreadyMatchedIds = new Set(existing.flatMap((m) => [m.a, m.b]));

  // Only members who have actually logged in and completed onboarding
  const allMembers = await db
    .select()
    .from(users)
    .where(ACTIVE_MEMBER_FILTER);

  const pool = allMembers.filter((u) => !alreadyMatchedIds.has(u.id));
  if (pool.length < 2) return 0;

  let pairsCreated = 0;
  const taken = new Set<string>();

  for (const user of pool) {
    if (taken.has(user.id)) continue;

    let bestScore = -1;
    let bestPartner: (typeof pool)[0] | null = null;
    let bestReason = "";

    for (const candidate of pool) {
      if (candidate.id === user.id || taken.has(candidate.id)) continue;
      const { score, reason } = scorePair(user, candidate);
      if (score > bestScore) {
        bestScore = score;
        bestPartner = candidate;
        bestReason = reason;
      }
    }

    if (bestPartner) {
      await db
        .insert(buddyMatches)
        .values({
          userAId: user.id,
          userBId: bestPartner.id,
          status: "active",
          matchScore: bestScore,
          matchReason: bestReason || "great match",
          pairedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [buddyMatches.userAId, buddyMatches.userBId],
          set: { status: "active", matchScore: bestScore, matchReason: bestReason || "great match", pairedAt: new Date() },
        });

      const userAName = user.firstName ?? "Your buddy";
      const userBName = bestPartner.firstName ?? "Your buddy";

      // Notify both members and kick off their conversation (fire-and-forget)
      Promise.all([
        createNotification(user.id, {
          type: "buddy_checkin",
          title: `You've been matched with ${userBName}! 🎉`,
          body: "Head to your buddy page to say hi and start your accountability journey.",
          actionUrl: "/community/buddy",
        }),
        createNotification(bestPartner.id, {
          type: "buddy_checkin",
          title: `You've been matched with ${userAName}! 🎉`,
          body: "Head to your buddy page to say hi and start your accountability journey.",
          actionUrl: "/community/buddy",
        }),
        kickoffConversation(user.id, bestPartner.id),
      ]).catch(() => {});

      taken.add(user.id);
      taken.add(bestPartner.id);
      pairsCreated++;
    }
  }

  return pairsCreated;
}

/**
 * Called after onboarding. Runs the full bulk match so the new member AND
 * any previously-waiting members all get paired in one pass.
 */
export async function autoMatch(_userId: string) {
  return runBulkMatch();
}

/**
 * Find active buddy pairs where one person sent a message 24+ hours ago and
 * their buddy has never replied. End those matches and re-run bulk matching
 * so both people get paired with someone responsive.
 *
 * "Ghosted" = a conversation where only one sender has spoken AND the last
 * message from that sender is more than 24 hours old.
 */
export async function rematchGhostedBuddies(): Promise<{ ended: number; newPairs: number }> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Fetch all active matches
  const active = await db
    .select({
      id: buddyMatches.id,
      userAId: buddyMatches.userAId,
      userBId: buddyMatches.userBId,
    })
    .from(buddyMatches)
    .where(eq(buddyMatches.status, "active"));

  const ghostedMatchIds: string[] = [];

  for (const match of active) {
    const [minId, maxId] =
      match.userAId < match.userBId
        ? [match.userAId, match.userBId]
        : [match.userBId, match.userAId];

    // Find their shared conversation
    const [conv] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.userMinId, minId), eq(conversations.userMaxId, maxId)))
      .limit(1);

    if (!conv) continue;

    // Count distinct senders and check if oldest message is past the cutoff
    const stats = await db
      .select({
        senderCount: sql<number>`COUNT(DISTINCT ${messages.senderId})`,
        oldestMessage: sql<Date>`MIN(${messages.createdAt})`,
      })
      .from(messages)
      .where(eq(messages.conversationId, conv.id));

    const { senderCount, oldestMessage } = stats[0] ?? {};
    if (!senderCount || senderCount === 0) continue; // no messages at all — not ghosted yet

    const onlyOneSenderSpoke = Number(senderCount) === 1;
    const messageIsOldEnough = oldestMessage && new Date(oldestMessage) < cutoff;

    if (onlyOneSenderSpoke && messageIsOldEnough) {
      ghostedMatchIds.push(match.id);
    }
  }

  if (ghostedMatchIds.length === 0) return { ended: 0, newPairs: 0 };

  // End the ghosted matches
  for (const matchId of ghostedMatchIds) {
    await db
      .update(buddyMatches)
      .set({ status: "ended" })
      .where(eq(buddyMatches.id, matchId));
  }

  // Notify the person who was left on read
  const endedMatches = active.filter((m) => ghostedMatchIds.includes(m.id));
  for (const match of endedMatches) {
    const [minId, maxId] =
      match.userAId < match.userBId
        ? [match.userAId, match.userBId]
        : [match.userBId, match.userAId];

    const [conv] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.userMinId, minId), eq(conversations.userMaxId, maxId)))
      .limit(1);

    if (!conv) continue;

    // Find who sent the unanswered message (they deserve a new match)
    const [firstMsg] = await db
      .select({ senderId: messages.senderId })
      .from(messages)
      .where(eq(messages.conversationId, conv.id))
      .limit(1);

    if (firstMsg) {
      await createNotification(firstMsg.senderId, {
        type: "buddy_checkin",
        title: "We found you a better match!",
        body: "Your previous buddy wasn't responsive, so we've re-matched you. Head to your buddy page to meet them.",
        actionUrl: "/community/buddy",
      }).catch(() => {});
    }
  }

  // Re-run bulk match so freed members get new buddies
  const newPairs = await runBulkMatch();

  return { ended: ghostedMatchIds.length, newPairs };
}
