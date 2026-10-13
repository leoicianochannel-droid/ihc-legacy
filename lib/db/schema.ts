/**
 * Infinity Hoop Community — Database schema (Drizzle / Postgres)
 *
 * Tables are grouped by domain:
 *   - Identity: users, subscriptions
 *   - Content: workouts, recipes, challenges
 *   - Engagement: posts, comments, likes, streaks, activity_log
 *   - Accountability: buddy_matches, progress_entries, grocery_lists
 *   - System: notifications, migration_records
 */

import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
  uuid,
  date,
  serial,
  uniqueIndex,
  index,
  real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ──────────────────────────── Enums ──────────────────────────── */

export const roleEnum = pgEnum("role", ["member", "admin", "coach"]);
export const subStatusEnum = pgEnum("sub_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "unpaid",
]);
export const planEnum = pgEnum("plan", ["monthly", "annual", "free"]);
export const tierEnum = pgEnum("tier", ["starter", "mover", "champion", "legend"]);
export const intensityEnum = pgEnum("intensity", ["beginner", "intermediate", "advanced"]);
export const postCategoryEnum = pgEnum("post_category", [
  "wins",
  "questions",
  "recipes",
  "transformation",
  "general",
]);
export const activityTypeEnum = pgEnum("activity_type", [
  "workout_completed",
  "recipe_saved",
  "daily_checkin",
  "post_created",
  "comment_created",
  "challenge_day_completed",
  "buddy_checkin",
]);
export const buddyStatusEnum = pgEnum("buddy_status", [
  "pending",
  "active",
  "paused",
  "ended",
]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "streak_risk",
  "buddy_checkin",
  "post_reply",
  "mention",
  "challenge_starting",
  "milestone_reached",
  "billing",
  "system",
]);
export const referralStatusEnum = pgEnum("referral_status", [
  "pending",
  "activated",
  "rewarded",
]);

/* ────────────────────────── Identity ─────────────────────────── */

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkId: text("clerk_id").unique(),
    email: text("email").notNull().unique(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    avatarUrl: text("avatar_url"),
    role: roleEnum("role").default("member").notNull(),

    // Onboarding answers (migrated from Skool Q1-Q3 + our extended flow)
    purchaseEmail: text("purchase_email"),              // Q1 answer
    age: integer("age"),
    workoutPreferences: text("workout_preferences"),    // Q2 answer (free text)
    movementTiming: text("movement_timing"),            // when they usually move
    idealBuddyWords: text("ideal_buddy_words"),         // Q3 answer (e.g. "fun, focused, encouraging")
    checkInStyle: text("check_in_style"),               // soft / chill / accountability

    // Competitive / retention survey (onboarding step 4)
    otherMemberships: text("other_memberships"),         // comma-separated list e.g. "peloton,gym"
    otherMembershipsReason: text("other_memberships_reason"), // free text: why they keep paying

    // Unique Shopify discount code generated per member (70% off, traceable)
    shopDiscountCode: text("shop_discount_code").unique(),

    // Personalization (phase 2)
    goal: text("goal"),                                 // e.g. "lose 20 lbs", "feel stronger"
    fitnessLevel: intensityEnum("fitness_level"),
    weeklyTargetMinutes: integer("weekly_target_minutes").default(120),
    injuries: text("injuries"),
    timezone: text("timezone").default("America/New_York"),
    reminderTime: text("reminder_time"),                   // "HH:00" e.g. "07:00" — daily workout nudge

    // State
    planCompletedAt: timestamp("plan_completed_at", { withTimezone: true }),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    welcomeAcknowledgedAt: timestamp("welcome_acknowledged_at", { withTimezone: true }),
    // Welcome tour video — set when they finish or skip the demo
    demoVideoWatchedAt: timestamp("demo_video_watched_at", { withTimezone: true }),
    demoVideoSkippedAt: timestamp("demo_video_skipped_at", { withTimezone: true }),
    migratedFromSkool: boolean("migrated_from_skool").default(false).notNull(),
    skoolJoinedAt: timestamp("skool_joined_at", { withTimezone: true }),

    // Referral program — each member gets a unique shareable code
    referralCode: text("referral_code").unique(),
    referredByUserId: uuid("referred_by_user_id"),

    // Tier system — auto-computed from workouts done + streak length
    tier: tierEnum("tier").default("starter").notNull(),
    tierUnlockedAt: timestamp("tier_unlocked_at", { withTimezone: true }),

    // Free access (beta / comp) — gets full platform access without needing
    // an active Skio subscription, but ONLY UNTIL the freeAccessUntil date.
    // After that date, they hit the paywall and must subscribe to continue.
    isBetaTester: boolean("is_beta_tester").default(false).notNull(),
    freeAccessUntil: timestamp("free_access_until", { withTimezone: true }),
    betaNote: text("beta_note"),

    // Tracks which day-milestone celebrations the member has already seen
    // (e.g. [30, 60]) so we only show each unlock celebration once.
    celebratedMilestones: integer("celebrated_milestones").array().default([]).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
    clerkIdx: index("users_clerk_idx").on(t.clerkId),
  })
);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Skio is the source of truth — these store the linked IDs so we can verify.
  skioSubscriptionId: text("skio_subscription_id").unique(),
  shopifyCustomerId: text("shopify_customer_id"),
  // Legacy Stripe fields (kept for any prior signups; no new writes).
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripePriceId: text("stripe_price_id"),
  status: subStatusEnum("status").notNull(),
  plan: planEnum("plan").notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAt: timestamp("cancel_at", { withTimezone: true }),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ────────────────────────── Content ──────────────────────────── */

export const workouts = pgTable("workouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").unique().notNull(),
  title: text("title").notNull(),
  description: text("description"),
  instructor: text("instructor"),
  durationMin: integer("duration_min").notNull(),
  intensity: intensityEnum("intensity").notNull(),
  bodyFocus: text("body_focus").array().default([]).notNull(),       // ["core", "legs"]
  equipment: text("equipment").array().default([]).notNull(),         // ["hoop", "mat"]
  usesHoop: boolean("uses_hoop").default(true).notNull(),
  muxAssetId: text("mux_asset_id"),
  muxPlaybackId: text("mux_playback_id"),
  // Cloudflare Stream — primary video provider going forward
  cfStreamUid: text("cf_stream_uid"),
  cfStreamStatus: text("cf_stream_status"),  // queued, inprogress, ready, error
  cfCustomerCode: text("cf_customer_code"),  // for branded subdomain URLs
  thumbnailUrl: text("thumbnail_url"),
  caloriesBurnedEst: integer("calories_burned_est"),
  // Transcript: array of { t: number (seconds), text: string }
  transcript: jsonb("transcript").$type<Array<{ t: number; text: string }>>(),
  // Collection = the "module" this workout belongs to (e.g. "2 Week Pre-Hoop",
  // "Cardio Dance Moves"). null = standalone. Used to group on /workouts.
  collection: text("collection"),
  // If true, this workout is only shown inside a challenge — not on /workouts.
  // Used for challenge-only videos like the 6-week challenge.
  challengeOnly: boolean("challenge_only").default(false).notNull(),
  // Days since onboarding required to access this workout. null = always available.
  // Members who've already completed it retain access regardless (grandfather clause).
  unlocksAtDay: integer("unlocks_at_day"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const recipes = pgTable("recipes", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").unique().notNull(),
  title: text("title").notNull(),
  description: text("description"),
  mealType: text("meal_type").notNull(),                              // breakfast / lunch / dinner / snack
  dietaryTags: text("dietary_tags").array().default([]).notNull(),    // ["gluten-free","dairy-free","vegetarian"]
  timeMin: integer("time_min"),
  servings: integer("servings").default(1),
  calories: integer("calories"),
  proteinG: real("protein_g"),
  carbsG: real("carbs_g"),
  fatG: real("fat_g"),
  ingredients: jsonb("ingredients").$type<Array<{ item: string; amount: string; aisle?: string }>>(),
  steps: jsonb("steps").$type<string[]>(),
  photoUrl: text("photo_url"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const challenges = pgTable("challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").unique().notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  description: text("description"),
  coverUrl: text("cover_url"),
  durationDays: integer("duration_days").notNull(),                   // 45 for the flagship
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  isRolling: boolean("is_rolling").default(false).notNull(),          // if true, members start on join date
  isActive: boolean("is_active").default(true).notNull(),
  rewardDescription: text("reward_description"),                       // e.g. "50% off your next hoop"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const challengeDays = pgTable("challenge_days", {
  id: uuid("id").defaultRandom().primaryKey(),
  challengeId: uuid("challenge_id")
    .notNull()
    .references(() => challenges.id, { onDelete: "cascade" }),
  dayNumber: integer("day_number").notNull(),
  title: text("title"),
  description: text("description"),
  workoutId: uuid("workout_id").references(() => workouts.id),
  recipeId: uuid("recipe_id").references(() => recipes.id),
  reflectionPrompt: text("reflection_prompt"),
}, (t) => ({
  challengeDayIdx: uniqueIndex("challenge_day_unique").on(t.challengeId, t.dayNumber),
}));

export const challengeMembers = pgTable("challenge_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  challengeId: uuid("challenge_id")
    .notNull()
    .references(() => challenges.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  currentDay: integer("current_day").default(1).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => ({
  uniqueMember: uniqueIndex("challenge_member_unique").on(t.challengeId, t.userId),
}));

/**
 * Downloadable resources attached to a challenge — cheat sheets, printable
 * trackers, meal-prep guides, etc. Stored on Vercel Blob.
 */
export const challengeResources = pgTable("challenge_resources", {
  id: uuid("id").defaultRandom().primaryKey(),
  challengeId: uuid("challenge_id")
    .notNull()
    .references(() => challenges.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(),                              // "pdf" | "image" | "doc"
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  challengeIdx: index("challenge_resources_challenge_idx").on(t.challengeId),
}));

export const challengeCheckins = pgTable("challenge_checkins", {
  id: uuid("id").defaultRandom().primaryKey(),
  challengeMemberId: uuid("challenge_member_id")
    .notNull()
    .references(() => challengeMembers.id, { onDelete: "cascade" }),
  dayNumber: integer("day_number").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
  note: text("note"),
  mood: integer("mood"),                                              // 1-5 scale
});

/* ───────────────────────── Engagement ────────────────────────── */

export const streaks = pgTable("streaks", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  current: integer("current").default(0).notNull(),
  longest: integer("longest").default(0).notNull(),
  lastActionDate: date("last_action_date"),
  freezeTokens: integer("freeze_tokens").default(1).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: activityTypeEnum("type").notNull(),
    referenceId: uuid("reference_id"),                                // workout_id, recipe_id, post_id, etc.
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userCreatedIdx: index("activity_user_created_idx").on(t.userId, t.createdAt),
  })
);

export const posts = pgTable("posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  category: postCategoryEnum("category").default("general").notNull(),
  body: text("body").notNull(),
  photoUrls: text("photo_urls").array().default([]).notNull(),                // legacy
  // Attachments — photos AND PDFs. Each entry has type, url, filename, size.
  attachments: jsonb("attachments")
    .$type<Array<{ type: "image" | "pdf" | "video" | "gif"; url: string; filename: string; size: number }>>()
    .default([]),
  likeCount: integer("like_count").default(0).notNull(),
  commentCount: integer("comment_count").default(0).notNull(),
  pinnedBy: uuid("pinned_by").references(() => users.id),
  pinnedAt: timestamp("pinned_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const postComments = pgTable("post_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  parentId: uuid("parent_id"),                                        // for nested replies
  attachments: jsonb("attachments")
    .default([])
    .notNull()
    .$type<Array<{ type: "image" | "video" | "gif"; url: string; filename: string; size: number }>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const workoutComments = pgTable(
  "workout_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    workoutCreatedIdx: index("workout_comments_workout_created_idx").on(t.workoutId, t.createdAt),
  })
);

export const postLikes = pgTable(
  "post_likes",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: uniqueIndex("post_likes_pk").on(t.postId, t.userId),
  })
);

export const postReactions = pgTable(
  "post_reactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unique: uniqueIndex("post_reaction_unique").on(t.postId, t.userId, t.emoji),
  })
);

/**
 * Real-time presence — who is actively hooping right now. The workout
 * player sends a heartbeat every ~30s; rows with `lastPingAt` older than
 * 2 minutes are considered stale (the user closed the tab without an
 * explicit "end" event firing).
 *
 * One row per user (userId is the primary key) so a member doesn't show
 * up multiple times if they open the same video on phone + laptop.
 */
export const liveSessions = pgTable("live_sessions", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  workoutId: uuid("workout_id").references(() => workouts.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  lastPingAt: timestamp("last_ping_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Site-wide settings — small key/value bag for admin-configurable values
 * that we don't want to redeploy for. Stored as text so callers do their
 * own parsing. Use sparingly — for genuinely site-wide knobs only.
 */
export const siteSettings = pgTable("site_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Web Push subscriptions. One row per device the member has enabled
 * notifications on. Keyed by `endpoint` (unique per browser/device pair).
 * Deleted on send-time 404/410 errors so dead devices don't accumulate.
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => ({
    endpointUniq: uniqueIndex("push_subscriptions_endpoint_uniq").on(t.endpoint),
    userIdx: index("push_subscriptions_user_idx").on(t.userId),
  })
);

/**
 * Admin invitation links. An admin generates a token, shares the URL
 * (`/admin-join/<token>`), and anyone who signs up via that link gets
 * `role: "admin"` automatically. Tokens are revocable, can be single- or
 * multi-use, and can carry an optional expiry.
 */
export const adminInvites = pgTable(
  "admin_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    token: text("token").notNull(),
    label: text("label"),                                                 // human note: "Chris team", "Cofounder", etc.
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    maxUses: integer("max_uses"),                                          // null = unlimited
    usedCount: integer("used_count").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tokenUniq: uniqueIndex("admin_invites_token_uniq").on(t.token),
  })
);

/* ────────────────────── Direct messages ───────────────────────
   1:1 DMs only for v1. The conversation is keyed by an ordered
   pair (userMinId, userMaxId) — we always store the smaller UUID
   as userMinId so look-ups are deterministic regardless of who
   started the chat, and the unique index prevents duplicates.
   ─────────────────────────────────────────────────────────────── */

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userMinId: uuid("user_min_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userMaxId: uuid("user_max_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pair: uniqueIndex("conversations_pair_uniq").on(t.userMinId, t.userMaxId),
    userMinIdx: index("conversations_user_min_idx").on(t.userMinId),
    userMaxIdx: index("conversations_user_max_idx").on(t.userMaxId),
  })
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    convCreatedIdx: index("messages_conv_created_idx").on(t.conversationId, t.createdAt),
  })
);

/**
 * Feedback collected at the end of a challenge — one row per member.
 * Drives the post-completion CTA: if rating is high we ask for a Trustpilot
 * review; if low we silently note the friction so we can improve.
 */
export const challengeFeedback = pgTable(
  "challenge_feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    challengeMemberId: uuid("challenge_member_id")
      .notNull()
      .references(() => challengeMembers.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),                                // 1-5
    wouldRecommend: boolean("would_recommend").notNull(),
    favoritePart: text("favorite_part"),
    improvement: text("improvement"),
    willReview: boolean("will_review").default(false).notNull(),        // they said yes to leaving a review
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    memberIdx: uniqueIndex("challenge_feedback_member_uniq").on(t.challengeMemberId),
  })
);

/**
 * Contest enrollment — one row per (challenge, member).
 * Members must enroll to access the contest dashboard and start logging entries.
 */
export const contestEnrollments = pgTable(
  "contest_enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    instagramHandle: text("instagram_handle"),
    tiktokHandle: text("tiktok_handle"),
    startWaistInches: real("start_waist_inches"),
    // admin-assigned winner categories — e.g. ['reel', 'inches']
    wonCategories: text("won_categories").array().default([]),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqueEnrollment: uniqueIndex("contest_enrollment_unique").on(t.challengeId, t.userId),
  })
);

/**
 * Individual content entries logged by a contest enrollee.
 * Multiple entries per person per type — they keep adding throughout the challenge.
 * entryType: 'reel' | 'nsv' | 'measurement' | 'transformation'
 */
export const contestEntries = pgTable("contest_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  enrollmentId: uuid("enrollment_id")
    .notNull()
    .references(() => contestEnrollments.id, { onDelete: "cascade" }),
  entryType: text("entry_type").notNull(),
  // reel fields
  reelUrl: text("reel_url"),
  reelPlatform: text("reel_platform"),   // 'instagram' | 'tiktok' | 'youtube'
  reelViewCount: integer("reel_view_count"),
  // nsv / transformation / reel caption
  title: text("title"),
  story: text("story"),
  photoUrls: text("photo_urls").array(),
  // measurement fields
  waistInches: real("waist_inches"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ─────────────────────── Accountability ──────────────────────── */

export const buddyMatches = pgTable(
  "buddy_matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userAId: uuid("user_a_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userBId: uuid("user_b_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: buddyStatusEnum("status").default("pending").notNull(),
    matchScore: real("match_score"),                                  // computed from onboarding prefs
    matchReason: text("match_reason"),                                // "both 35-45, both morning movers, both 'fun focused'"
    pairedAt: timestamp("paired_at", { withTimezone: true }).defaultNow().notNull(),
    lastCheckInAt: timestamp("last_check_in_at", { withTimezone: true }),
  },
  (t) => ({
    uniquePair: uniqueIndex("buddy_unique_pair").on(t.userAId, t.userBId),
  })
);

export const buddyCheckins = pgTable("buddy_checkins", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id")
    .notNull()
    .references(() => buddyMatches.id, { onDelete: "cascade" }),
  fromUserId: uuid("from_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const progressEntries = pgTable(
  "progress_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entryDate: date("entry_date").notNull(),
    weightLb: real("weight_lb"),
    photoUrls: text("photo_urls").array().default([]).notNull(),      // stored privately
    measurements: jsonb("measurements").$type<{
      waist?: number; hips?: number; chest?: number; thigh?: number; arm?: number;
    }>(),
    mood: integer("mood"),                                            // 1-5
    energyLevel: integer("energy_level"),                             // 1-5
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userDateIdx: uniqueIndex("progress_user_date").on(t.userId, t.entryDate),
  })
);

export const groceryLists = pgTable("grocery_lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  weekStartDate: date("week_start_date").notNull(),
  recipeIds: uuid("recipe_ids").array().default([]).notNull(),
  extraItems: jsonb("extra_items").$type<Array<{ item: string; amount?: string; checked?: boolean }>>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ────────────────────────── System ───────────────────────────── */

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  actionUrl: text("action_url"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ──────────────────── Tier Unlocks ─────────────────────────── */
// Records every tier crossing — used for celebration UI, email triggers,
// and "unlocked X days ago" stats.

export const tierUnlocks = pgTable(
  "tier_unlocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tier: tierEnum("tier").notNull(),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).defaultNow().notNull(),
    workoutsAtUnlock: integer("workouts_at_unlock").notNull(),
    streakAtUnlock: integer("streak_at_unlock").notNull(),
    celebrated: boolean("celebrated").default(false).notNull(),
  },
  (t) => ({
    userTierUnique: uniqueIndex("user_tier_unique").on(t.userId, t.tier),
  })
);

/* ──────────────────────── Programs ─────────────────────────── */
// Programs are structured multi-day plans where each day has multiple
// exercises (each linking to a workout video). E.g. "2 Week Pre-Hoop" has
// 14 days with 3-4 exercises per day. Distinct from workouts (flat library)
// and challenges (single workout per week).

export const programs = pgTable("programs", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").unique().notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  description: text("description"),
  coverUrl: text("cover_url"),
  durationDays: integer("duration_days").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  unlockAll: boolean("unlock_all").default(false).notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const programDays = pgTable(
  "program_days",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    dayNumber: integer("day_number").notNull(),
    title: text("title").notNull(),                                  // e.g. "Core Activation"
    description: text("description"),                                 // optional context
    isRestDay: boolean("is_rest_day").default(false).notNull(),
  },
  (t) => ({
    programDayUnique: uniqueIndex("program_day_unique").on(t.programId, t.dayNumber),
  })
);

export const programDayExercises = pgTable("program_day_exercises", {
  id: uuid("id").defaultRandom().primaryKey(),
  programDayId: uuid("program_day_id")
    .notNull()
    .references(() => programDays.id, { onDelete: "cascade" }),
  workoutId: uuid("workout_id").references(() => workouts.id, { onDelete: "set null" }),
  // Free-text exercise label like "Plank (30 sec x3)" — shown when no video
  // is linked, OR alongside the video as the "how many" instruction.
  label: text("label").notNull(),
  repsLabel: text("reps_label"),                                      // "30 sec x3", "15 reps", etc.
  sortOrder: integer("sort_order").default(0).notNull(),
});

export const programMembers = pgTable(
  "program_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    currentDay: integer("current_day").default(1).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    programMemberUnique: uniqueIndex("program_member_unique").on(t.programId, t.userId),
  })
);

export const programDayCompletions = pgTable(
  "program_day_completions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    programMemberId: uuid("program_member_id")
      .notNull()
      .references(() => programMembers.id, { onDelete: "cascade" }),
    dayNumber: integer("day_number").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    programDayDoneUnique: uniqueIndex("program_day_done_unique").on(t.programMemberId, t.dayNumber),
  })
);

/* ─────────────────── Referrals & Upgrades ─────────────────── */

export const referrals = pgTable("referrals", {
  id: uuid("id").defaultRandom().primaryKey(),
  referrerUserId: uuid("referrer_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  referredUserId: uuid("referred_user_id")
    .references(() => users.id, { onDelete: "set null" }),
  referredEmail: text("referred_email"),                               // before account creation
  status: referralStatusEnum("status").default("pending").notNull(),
  rewardAppliedAt: timestamp("reward_applied_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const premiumWaitlist = pgTable("premium_waitlist", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  email: text("email").notNull(),
  interestedFeatures: text("interested_features").array().default([]).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ─────────────────────── Migration ─────────────────────────── */

export const migrationRecords = pgTable("migration_records", {
  id: serial("id").primaryKey(),
  sourceEmail: text("source_email").notNull(),
  resolvedEmail: text("resolved_email"),
  sourceData: jsonb("source_data").$type<Record<string, string>>(),   // full CSV row
  userId: uuid("user_id").references(() => users.id),                 // null until user is created
  invitedAt: timestamp("invited_at", { withTimezone: true }),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  source: varchar("source", { length: 20 }).default("skool").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ──────────────────────── Relations ──────────────────────────── */

export const usersRelations = relations(users, ({ one, many }) => ({
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),
  streak: one(streaks, {
    fields: [users.id],
    references: [streaks.userId],
  }),
  posts: many(posts),
  activities: many(activityLog),
  progressEntries: many(progressEntries),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.userId], references: [users.id] }),
  comments: many(postComments),
  likes: many(postLikes),
}));

export const challengeRelations = relations(challenges, ({ many }) => ({
  days: many(challengeDays),
  members: many(challengeMembers),
}));

/* ─────────────────── Workout Ratings ───────────────────────── */
// One rating per user per workout. 1–5 stars. If rating >= 4 the UI
// prompts them to leave a Trustpilot review.

export const workoutRatings = pgTable(
  "workout_ratings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),               // 1–5
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userWorkoutUnique: uniqueIndex("workout_rating_user_workout").on(t.userId, t.workoutId),
  })
);

/* ──────────────────── Personalised Plan System ───────────────── */

/**
 * Stores the member's answers to the plan-setup quiz.
 * One row per quiz submission — keep history for future re-generation.
 */
export const planQuestionnaires = pgTable("plan_questionnaires", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Q1 — hooping experience
  experience: text("experience").notNull(), // 'never' | 'some' | 'regular'
  // Q2 — primary goal
  goal: text("goal").notNull(), // 'weight_loss' | 'toning' | 'cardio' | 'stress_relief'
  // Q3 — days per week they can commit
  daysPerWeek: integer("days_per_week").notNull(), // 2 | 3 | 4 | 5 | 6 | 7
  // Q4 — minutes per session
  minutesPerSession: integer("minutes_per_session").notNull(), // 20 | 30 | 45 | 60
  // Q5 — physical considerations (comma-separated if multiple)
  physicalNotes: text("physical_notes"), // 'none' | 'back' | 'joints' | 'postpartum' | 'injury'
  // Q6 — dietary preference
  dietaryPreference: text("dietary_preference"), // 'none' | 'weight_loss' | 'high_protein' | 'plant_based' | 'gluten_free'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * The generated 8-week plan for a member.
 * One active plan per user (UNIQUE on userId). Re-generation replaces the row.
 */
export const memberPlans = pgTable("member_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  questionnaireId: uuid("questionnaire_id").references(
    () => planQuestionnaires.id
  ),
  /** Full plan JSON — see MemberPlan type in lib/plan-types.ts */
  plan: jsonb("plan").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PlanQuestionnaire = typeof planQuestionnaires.$inferSelect;
export type MemberPlan = typeof memberPlans.$inferSelect;

/* ──────────────────────── Gift milestones ────────────────────── */

export const giftClaims = pgTable(
  "gift_claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    milestoneKey: text("milestone_key").notNull(), // 'month_2_tea' | 'month_3_arm_hoops' | 'month_4_free_month'
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).defaultNow().notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    // Shipping details (physical gifts)
    shippingName: text("shipping_name"),
    shippingLine1: text("shipping_line1"),
    shippingLine2: text("shipping_line2"),
    shippingCity: text("shipping_city"),
    shippingState: text("shipping_state"),
    shippingZip: text("shipping_zip"),
    shippingCountry: text("shipping_country").default("US"),
    // Fulfilment
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    adminNotes: text("admin_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqueUserMilestone: uniqueIndex("gift_claims_user_milestone_idx").on(
      t.userId,
      t.milestoneKey
    ),
  })
);

export type GiftClaim = typeof giftClaims.$inferSelect;

export const giftMilestones = pgTable(
  "gift_milestones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(),
    dayThreshold: integer("day_threshold").notNull(),
    label: text("label").notNull(),
    fullLabel: text("full_label").notNull(),
    description: text("description").notNull(),
    emoji: text("emoji").notNull().default("🎁"),
    retailValue: text("retail_value").notNull().default(""),
    requiresShipping: boolean("requires_shipping").notNull().default(false),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    keyIdx: uniqueIndex("gift_milestones_key_idx").on(t.key),
  })
);

export type GiftMilestoneRow = typeof giftMilestones.$inferSelect;

export const personalWorkouts = pgTable("personal_workouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  activityType: text("activity_type").notNull(),
  title: text("title"),
  durationMin: integer("duration_min").notNull(),
  notes: text("notes"),
  loggedAt: timestamp("logged_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PersonalWorkout = typeof personalWorkouts.$inferSelect;

/* ──────────────────────── Type exports ───────────────────────── */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type Challenge = typeof challenges.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Streak = typeof streaks.$inferSelect;
export type BuddyMatch = typeof buddyMatches.$inferSelect;
export type ProgressEntry = typeof progressEntries.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
export type PremiumWaitlistEntry = typeof premiumWaitlist.$inferSelect;
