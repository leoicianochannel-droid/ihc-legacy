import { db, users, streaks, activityLog, posts, postComments, challengeMembers, giftClaims } from "./db";
import { and, count, eq, sql } from "drizzle-orm";

export type Badge = {
  id: string;
  emoji: string;
  label: string;
  description: string;
  earned: boolean;
};

type BadgeDef = Omit<Badge, "earned"> & {
  check: (s: Stats) => boolean;
};

type Stats = {
  currentStreak: number;
  longestStreak: number;
  totalWorkouts: number;
  totalPosts: number;
  totalComments: number;
  reactionsReceived: number;
  challengeCompletions: number;
  giftsClaimed: number;
  daysMember: number;
  isFoundingMember: boolean;
};

const BADGE_DEFS: BadgeDef[] = [
  // Founding
  {
    id: "founding",
    emoji: "⭐",
    label: "Founding Member",
    description: "One of the original Infinity Hoop members who made this community possible.",
    check: (s) => s.isFoundingMember,
  },

  // Membership duration
  {
    id: "member_1m",
    emoji: "🌱",
    label: "One Month Strong",
    description: "Member for 30+ days.",
    check: (s) => s.daysMember >= 30,
  },
  {
    id: "member_3m",
    emoji: "🌿",
    label: "Three Month Club",
    description: "Member for 90+ days.",
    check: (s) => s.daysMember >= 90,
  },
  {
    id: "member_6m",
    emoji: "🌳",
    label: "Half-Year Hoop Queen",
    description: "Member for 180+ days. You're part of the foundation here.",
    check: (s) => s.daysMember >= 180,
  },

  // Streaks
  {
    id: "streak_7",
    emoji: "🔥",
    label: "First Flame",
    description: "Reached a 7-day streak. Consistency is everything.",
    check: (s) => s.longestStreak >= 7,
  },
  {
    id: "streak_30",
    emoji: "🔥🔥",
    label: "Streak Warrior",
    description: "Reached a 30-day streak. That's a whole month of showing up.",
    check: (s) => s.longestStreak >= 30,
  },
  {
    id: "streak_60",
    emoji: "👑",
    label: "Unstoppable",
    description: "Reached a 60-day streak. Absolute legend.",
    check: (s) => s.longestStreak >= 60,
  },

  // Workouts
  {
    id: "workout_1",
    emoji: "💪",
    label: "First Sweat",
    description: "Completed your first workout. The hardest step is always the first.",
    check: (s) => s.totalWorkouts >= 1,
  },
  {
    id: "workout_25",
    emoji: "🏃‍♀️",
    label: "Mover",
    description: "25 workouts completed. You're building something real.",
    check: (s) => s.totalWorkouts >= 25,
  },
  {
    id: "workout_100",
    emoji: "🏋️‍♀️",
    label: "Dedicated",
    description: "100 workouts. That's serious commitment.",
    check: (s) => s.totalWorkouts >= 100,
  },

  // Challenges
  {
    id: "challenge_1",
    emoji: "✅",
    label: "Challenge Finisher",
    description: "Completed a challenge from start to finish.",
    check: (s) => s.challengeCompletions >= 1,
  },
  {
    id: "challenge_3",
    emoji: "🏆",
    label: "Challenge Champion",
    description: "Finished 3 or more challenges. You keep coming back for more.",
    check: (s) => s.challengeCompletions >= 3,
  },

  // Community
  {
    id: "post_1",
    emoji: "📣",
    label: "First Post",
    description: "Shared something with the community. Your voice matters here.",
    check: (s) => s.totalPosts >= 1,
  },
  {
    id: "post_10",
    emoji: "🗣️",
    label: "Regular",
    description: "10+ community posts. This is your home.",
    check: (s) => s.totalPosts >= 10,
  },
  {
    id: "encourager",
    emoji: "❤️",
    label: "Encourager",
    description: "Left 25+ comments cheering others on.",
    check: (s) => s.totalComments >= 25,
  },
  {
    id: "community_star",
    emoji: "🌟",
    label: "Community Star",
    description: "Received 50+ reactions from the community.",
    check: (s) => s.reactionsReceived >= 50,
  },

  // Gifts
  {
    id: "gift_1",
    emoji: "🎁",
    label: "Gift Earner",
    description: "Earned your first loyalty gift milestone.",
    check: (s) => s.giftsClaimed >= 1,
  },
  {
    id: "gift_all",
    emoji: "🎀",
    label: "Full Set",
    description: "Claimed all three loyalty gift milestones.",
    check: (s) => s.giftsClaimed >= 3,
  },
];

export async function getBadgesForUser(userId: string): Promise<Badge[]> {
  const [member] = await db
    .select({ onboardedAt: users.onboardedAt, createdAt: users.createdAt, migratedFromSkool: users.migratedFromSkool })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!member) return [];

  const [
    streakRow,
    [{ wc }],
    [{ pc }],
    [{ cc }],
    [{ rc }],
    [{ chc }],
    [{ gc }],
  ] = await Promise.all([
    db.select({ current: streaks.current, longest: streaks.longest }).from(streaks).where(eq(streaks.userId, userId)).limit(1).then((r) => r[0] ?? { current: 0, longest: 0 }),
    db.select({ wc: count() }).from(activityLog).where(and(eq(activityLog.userId, userId), eq(activityLog.type, "workout_completed"))),
    db.select({ pc: count() }).from(posts).where(eq(posts.userId, userId)),
    db.select({ cc: count() }).from(postComments).where(eq(postComments.userId, userId)),
    db.select({ rc: sql<number>`coalesce(sum(${posts.likeCount}),0)::int` }).from(posts).where(eq(posts.userId, userId)),
    db.select({ chc: count() }).from(challengeMembers).where(and(eq(challengeMembers.userId, userId), sql`${challengeMembers.completedAt} is not null`)),
    db.select({ gc: count() }).from(giftClaims).where(and(eq(giftClaims.userId, userId), sql`${giftClaims.claimedAt} is not null`)),
  ]);

  const startDate = member.onboardedAt ?? member.createdAt;
  const daysMember = Math.floor((Date.now() - new Date(startDate).getTime()) / 86_400_000);

  const stats: Stats = {
    currentStreak: Number(streakRow.current),
    longestStreak: Number(streakRow.longest),
    totalWorkouts: Number(wc),
    totalPosts: Number(pc),
    totalComments: Number(cc),
    reactionsReceived: Number(rc),
    challengeCompletions: Number(chc),
    giftsClaimed: Number(gc),
    daysMember,
    isFoundingMember: member.migratedFromSkool ?? false,
  };

  return BADGE_DEFS.map((def) => ({
    id: def.id,
    emoji: def.emoji,
    label: def.label,
    description: def.description,
    earned: def.check(stats),
  }));
}
