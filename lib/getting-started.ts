/**
 * Getting Started checklist — computes which onboarding tasks each user has
 * completed. Used by the dashboard widget. Auto-hides when all 6 tasks are done.
 */
import { db, users, activityLog, posts, buddyMatches, progressEntries } from "./db";
import { eq, or, and, count, sql } from "drizzle-orm";

export type StartedTask = {
  id: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
};

export async function getGettingStartedStatus(userId: string): Promise<{
  tasks: StartedTask[];
  done: number;
  total: number;
  pct: number;
  shouldShow: boolean;       // false once 100% done — auto-hide
}> {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) {
    return { tasks: [], done: 0, total: 0, pct: 0, shouldShow: false };
  }

  // Run the checks in parallel for speed
  const [
    [{ workouts }],
    [{ recipes }],
    [{ postsCount }],
    [{ progressCount }],
    [{ buddiesCount }],
    personalWorkoutsResult,
  ] = await Promise.all([
    db
      .select({ workouts: count() })
      .from(activityLog)
      .where(and(eq(activityLog.userId, userId), eq(activityLog.type, "workout_completed"))),
    db
      .select({ recipes: count() })
      .from(activityLog)
      .where(and(eq(activityLog.userId, userId), eq(activityLog.type, "recipe_saved"))),
    db
      .select({ postsCount: count() })
      .from(posts)
      .where(eq(posts.userId, userId)),
    db
      .select({ progressCount: count() })
      .from(progressEntries)
      .where(eq(progressEntries.userId, userId)),
    db
      .select({ buddiesCount: count() })
      .from(buddyMatches)
      .where(or(eq(buddyMatches.userAId, userId), eq(buddyMatches.userBId, userId))),
    db.execute(sql`SELECT COUNT(*)::int AS n FROM personal_workouts WHERE user_id = ${userId}`).catch(() => [{ n: 0 }]),
  ]);
  const personalWorkouts = Number((personalWorkoutsResult as unknown as Array<{ n: number }>)[0]?.n ?? 0);

  const tasks: StartedTask[] = [
    {
      id: "goal",
      title: "Set your fitness goal",
      description: "Tell us what you're working toward — we tailor recommendations to it.",
      href: "/settings",
      done: !!u.goal,
    },
    {
      id: "buddy",
      title: "Get matched with a buddy",
      description: "An accountability partner who fits your vibe and schedule.",
      href: "/community/buddy",
      done: Number(buddiesCount ?? 0) > 0,
    },
    {
      id: "intro",
      title: "Introduce yourself in the community",
      description: "Where are you from? What's your goal? Let everyone meet you.",
      href: "/community",
      done: Number(postsCount ?? 0) > 0,
    },
    {
      id: "workout",
      title: "Watch your first workout",
      description: "Pick anything from the library — even 10 minutes counts.",
      href: "/workouts",
      done: Number(workouts ?? 0) > 0,
    },
    {
      id: "recipe",
      title: "Save your first recipe",
      description: "Tap '+ Add to this week' on any recipe to start your grocery list.",
      href: "/recipes",
      done: Number(recipes ?? 0) > 0,
    },
    {
      id: "before",
      title: "Take your 'before' progress photo",
      description: "Future you will thank you. It's private — only you ever see it.",
      href: "/progress",
      done: Number(progressCount ?? 0) > 0,
    },
    {
      id: "movement",
      title: "Log your first personal workout",
      description: "Track a walk, hoop session, or anything active — it all counts toward your streak.",
      href: "/activity",
      done: personalWorkouts > 0,
    },
  ];

  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const pct = Math.round((done / total) * 100);

  // Hide the widget once all 6 are done OR after 60 days since signup
  // (so seasoned members don't see it forever)
  const ageDays = u.createdAt
    ? Math.floor((Date.now() - new Date(u.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const shouldShow = done < total && ageDays < 60;

  return { tasks, done, total, pct, shouldShow };
}
