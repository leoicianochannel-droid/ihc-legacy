import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { MemberSidebar } from "@/components/member/sidebar";
import { TopBar } from "@/components/member/top-bar";
import { WelcomeModal } from "@/components/member/welcome-modal";
import { WelcomeTourModal } from "@/components/member/welcome-tour-modal";
import { GiftBanner } from "@/components/member/gift-banner";
import { ChallengeBanner } from "@/components/member/challenge-promo-banner";
import { MilestoneCelebration } from "@/components/member/milestone-celebration";
import { db, users, notifications, workouts, messages, conversations } from "@/lib/db";
import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { getWelcomeVideo } from "@/lib/welcome-video";
import { getGiftStatus, getDbMilestones, daysSince } from "@/lib/gifts";
import { INTENSITY_UNLOCK_DAYS, WORKOUT_UNLOCK_DAYS } from "@/lib/workout-access";

async function ensureMilestoneCelebrationColumn() {
  try {
    await db.execute(
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS celebrated_milestones integer[] NOT NULL DEFAULT '{}'`
    );
  } catch {
    // already exists — no-op
  }
}

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureMilestoneCelebrationColumn();

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  const showWelcome =
    dbUser?.onboardedAt && !dbUser?.welcomeAcknowledgedAt;

  const eligibleForTour =
    dbUser?.onboardedAt &&
    dbUser?.welcomeAcknowledgedAt &&
    !dbUser?.demoVideoWatchedAt &&
    !dbUser?.demoVideoSkippedAt;

  const [milestones, unreadResult, unreadDmResult] = await Promise.all([
    getDbMilestones(),
    dbUser
      ? db
          .select({ count: sql<number>`count(*)::int` })
          .from(notifications)
          .where(and(eq(notifications.userId, dbUser.id), isNull(notifications.readAt)))
          .catch(() => [{ count: 0 }])
      : Promise.resolve([{ count: 0 }]),
    dbUser
      ? db
          .select({ count: sql<number>`count(*)::int` })
          .from(messages)
          .innerJoin(conversations, eq(conversations.id, messages.conversationId))
          .where(
            and(
              or(eq(conversations.userMinId, dbUser.id), eq(conversations.userMaxId, dbUser.id)),
              ne(messages.senderId, dbUser.id),
              isNull(messages.readAt)
            )
          )
          .catch(() => [{ count: 0 }])
      : Promise.resolve([{ count: 0 }]),
  ]);

  const unreadCount = Number(unreadResult[0]?.count ?? 0);
  const unreadDmCount = Number(unreadDmResult[0]?.count ?? 0);
  const giftStatus = getGiftStatus(
    dbUser?.onboardedAt ?? dbUser?.createdAt ?? null,
    [], // gifts are now automatic — no claim tracking needed
    milestones
  );

  // ── Milestone celebration ────────────────────────────────────────────────
  // Find the highest day threshold the member has crossed but not yet celebrated.
  // We show one modal per visit (highest threshold), and mark all lower ones
  // as seen at the same time so they never stack up.
  let celebrationData: {
    day: number;
    allDaysToMark: number[];
    unlockedWorkouts: { title: string; slug: string }[];
    giftEarned: { label: string; emoji: string; fullLabel: string } | null;
  } | null = null;

  if (dbUser?.onboardedAt) {
    const memberDays = daysSince(dbUser.onboardedAt ?? dbUser.createdAt);
    const celebrated = new Set(dbUser.celebratedMilestones ?? []);

    const allThresholds = new Set<number>([
      ...milestones.map((m) => m.dayThreshold),
      ...WORKOUT_UNLOCK_DAYS,
    ]);

    const uncelebrated = [...allThresholds]
      .filter((d) => d <= memberDays && !celebrated.has(d))
      .sort((a, b) => b - a);

    const celebrationDay = uncelebrated[0] ?? null;

    if (celebrationDay !== null) {
      // Intensity-based: find workouts whose rule maps to this day,
      // plus any with an explicit override for this day.
      const intensitiesForDay = Object.entries(INTENSITY_UNLOCK_DAYS)
        .filter(([, day]) => day === celebrationDay)
        .map(([intensity]) => intensity);

      const celebrationWorkouts = await db
        .select({
          title: workouts.title,
          slug: workouts.slug,
          intensity: workouts.intensity,
          unlocksAtDay: workouts.unlocksAtDay,
        })
        .from(workouts)
        .where(eq(workouts.challengeOnly, false))
        .catch(() => [])
        .then((all) =>
          all
            .filter(
              (w) =>
                (w.unlocksAtDay === null && intensitiesForDay.includes(w.intensity)) ||
                w.unlocksAtDay === celebrationDay
            )
            .map(({ title, slug }) => ({ title, slug }))
        );

      const giftForDay = milestones.find((m) => m.dayThreshold === celebrationDay) ?? null;

      celebrationData = {
        day: celebrationDay,
        allDaysToMark: uncelebrated,
        unlockedWorkouts: celebrationWorkouts,
        giftEarned: giftForDay
          ? { label: giftForDay.label, emoji: giftForDay.emoji, fullLabel: giftForDay.fullLabel }
          : null,
      };
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  let welcomeVideo: Awaited<ReturnType<typeof getWelcomeVideo>> = null;
  if (eligibleForTour) {
    welcomeVideo = await getWelcomeVideo();
  }

  return (
    <div className="flex min-h-screen">
      <MemberSidebar isAdmin={dbUser?.role === "admin"} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar unreadCount={unreadCount} unreadDmCount={unreadDmCount} giftReady={giftStatus.readyToClaim.length > 0} />
        <ChallengeBanner />
        <div className="flex-1 pb-[calc(env(safe-area-inset-bottom)+160px)] md:pb-16">
          {children}
        </div>
      </div>
      {showWelcome && <WelcomeModal />}
      {!showWelcome && welcomeVideo && (
        <WelcomeTourModal
          videoUid={welcomeVideo.uid}
          customerCode={welcomeVideo.customerCode}
          durationSec={welcomeVideo.durationSec}
          embedUrl={welcomeVideo.embedUrl}
        />
      )}
      {!showWelcome && !welcomeVideo && celebrationData && (
        <MilestoneCelebration data={celebrationData} />
      )}
    </div>
  );
}
