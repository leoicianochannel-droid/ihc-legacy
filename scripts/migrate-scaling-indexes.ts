/**
 * Adds production-critical indexes for queries that get heavy at 10K+ members.
 * Idempotent — uses IF NOT EXISTS so it's safe to re-run after each release.
 *
 * Each index is justified by a real query in the codebase; greppable by name.
 */
import { db } from "../lib/db";
import { sql } from "drizzle-orm";

const STATEMENTS = [
  // ── Posts feed (community page, ordered by pinnedAt + createdAt) ─────────
  // The community feed orders by pinned then created; this composite supports
  // "most recent first" and "filter by category, then most recent".
  `CREATE INDEX IF NOT EXISTS posts_created_at_idx
     ON posts (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS posts_category_created_idx
     ON posts (category, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS posts_user_id_idx
     ON posts (user_id)`,

  // ── Comments — preview-comments-per-post + top-poster aggregations ───────
  `CREATE INDEX IF NOT EXISTS post_comments_post_created_idx
     ON post_comments (post_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS post_comments_user_created_idx
     ON post_comments (user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS post_comments_created_at_idx
     ON post_comments (created_at DESC)`,

  // ── Likes — weekly community pulse + counts per post ─────────────────────
  `CREATE INDEX IF NOT EXISTS post_likes_user_id_idx
     ON post_likes (user_id)`,
  `CREATE INDEX IF NOT EXISTS post_likes_created_at_idx
     ON post_likes (created_at DESC)`,

  // ── Activity log — DAU/WAU/MAU, retention, leaderboards ──────────────────
  // The activity_user_created_idx already exists; add the inverse for date-range
  // admin aggregates that don't filter by user first.
  `CREATE INDEX IF NOT EXISTS activity_log_created_at_idx
     ON activity_log (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS activity_log_type_created_idx
     ON activity_log (type, created_at DESC)`,

  // ── Users ─────────────────────────────────────────────────────────────────
  `CREATE INDEX IF NOT EXISTS users_created_at_idx
     ON users (created_at DESC)`,
  // Partial index — most users are 'member', filtering on role <> 'member' is
  // a tiny subset (admins/coaches). Saves space + faster.
  `CREATE INDEX IF NOT EXISTS users_role_partial_idx
     ON users (role) WHERE role <> 'member'`,

  // ── Subscriptions — admin churn + active counts ──────────────────────────
  `CREATE INDEX IF NOT EXISTS subscriptions_status_idx
     ON subscriptions (status)`,
  `CREATE INDEX IF NOT EXISTS subscriptions_status_updated_idx
     ON subscriptions (status, updated_at DESC)`,

  // ── Messages inbox — ordering conversations by latest message ────────────
  `CREATE INDEX IF NOT EXISTS conversations_last_message_idx
     ON conversations (last_message_at DESC NULLS LAST)`,
  `CREATE INDEX IF NOT EXISTS messages_sender_id_idx
     ON messages (sender_id)`,

  // ── Live presence — getActiveHoopers filters by last_ping_at ─────────────
  `CREATE INDEX IF NOT EXISTS live_sessions_last_ping_idx
     ON live_sessions (last_ping_at DESC)`,

  // ── Streaks — leaderboard "top by current streak" ────────────────────────
  // Partial: only members with active streaks (current > 0) get indexed.
  `CREATE INDEX IF NOT EXISTS streaks_current_partial_idx
     ON streaks (current DESC) WHERE current > 0`,

  // ── Push subscriptions — bulk send per user ──────────────────────────────
  // user_id index already exists.

  // ── Recipes — meal_type, time, dietary filters on /recipes ───────────────
  `CREATE INDEX IF NOT EXISTS recipes_meal_type_idx
     ON recipes (meal_type)`,
  `CREATE INDEX IF NOT EXISTS recipes_published_at_idx
     ON recipes (published_at DESC NULLS LAST)`,
  // GIN index on dietary_tags array for `<value> = ANY(dietary_tags)` queries
  `CREATE INDEX IF NOT EXISTS recipes_dietary_tags_gin
     ON recipes USING GIN (dietary_tags)`,

  // ── Workouts — listing + intensity filter ────────────────────────────────
  `CREATE INDEX IF NOT EXISTS workouts_intensity_published_idx
     ON workouts (intensity, published_at DESC NULLS LAST)`,

  // ── Progress entries — already has unique(user, date); add date-only for
  // any cohort analysis.
  `CREATE INDEX IF NOT EXISTS progress_entries_entry_date_idx
     ON progress_entries (entry_date DESC)`,
];

async function main() {
  let created = 0;
  for (const stmt of STATEMENTS) {
    const indexName = stmt.match(/INDEX IF NOT EXISTS (\w+)/)?.[1] ?? "?";
    try {
      await db.execute(sql.raw(stmt));
      console.log(`✓ ${indexName}`);
      created++;
    } catch (err) {
      console.error(`✗ ${indexName}`, err);
    }
  }
  console.log(`\nDone. ${created}/${STATEMENTS.length} index ensure-statements executed.`);
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
