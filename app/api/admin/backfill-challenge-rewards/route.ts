import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { getHighestEarnedReward, CHALLENGE_REWARDS } from "@/lib/challenge-rewards";

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const [admin] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (admin?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Create the table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS challenge_reward_claims (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      challenge_member_id UUID NOT NULL,
      challenge_slug TEXT NOT NULL,
      tier_min_completed INTEGER NOT NULL,
      reward_label TEXT NOT NULL,
      reward_items TEXT NOT NULL,
      earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      claimed_at TIMESTAMPTZ,
      shipped_at TIMESTAMPTZ,
      admin_notes TEXT,
      shipping_name TEXT,
      shipping_line1 TEXT,
      shipping_line2 TEXT,
      shipping_city TEXT,
      shipping_state TEXT,
      shipping_zip TEXT,
      shipping_country TEXT DEFAULT 'US',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(challenge_member_id)
    );
    CREATE INDEX IF NOT EXISTS challenge_reward_claims_user_idx ON challenge_reward_claims (user_id);
    CREATE INDEX IF NOT EXISTS challenge_reward_claims_slug_idx ON challenge_reward_claims (challenge_slug);
  `);

  // Find all challenge members for reward-eligible challenges and their check-in counts
  const eligibleSlugs = Object.keys(CHALLENGE_REWARDS);
  const slugList = eligibleSlugs.map(s => `'${s.replace(/'/g, "''")}'`).join(", ");

  const members = await db.execute(sql.raw(`
    SELECT
      cm.id AS challenge_member_id,
      cm.user_id,
      c.slug AS challenge_slug,
      COUNT(DISTINCT cc.day_number) AS completed_count
    FROM challenge_members cm
    JOIN challenges c ON c.id = cm.challenge_id
    LEFT JOIN challenge_checkins cc ON cc.challenge_member_id = cm.id
    WHERE c.slug IN (${slugList})
    GROUP BY cm.id, cm.user_id, c.slug
    HAVING COUNT(DISTINCT cc.day_number) >= 7
  `));

  let inserted = 0;
  let skipped = 0;

  for (const row of members as any[]) {
    const earned = getHighestEarnedReward(row.challenge_slug, Number(row.completed_count));
    if (!earned) { skipped++; continue; }

    await db.execute(sql`
      INSERT INTO challenge_reward_claims
        (user_id, challenge_member_id, challenge_slug, tier_min_completed, reward_label, reward_items)
      VALUES
        (${row.user_id}, ${row.challenge_member_id}, ${row.challenge_slug},
         ${earned.minCompleted}, ${earned.label}, ${earned.items.join(", ")})
      ON CONFLICT (challenge_member_id) DO NOTHING
    `);
    inserted++;
  }

  return NextResponse.json({ ok: true, inserted, skipped, total: (members as any[]).length });
}
