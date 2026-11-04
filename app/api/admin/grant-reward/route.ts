import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

// POST /api/admin/grant-reward
// Body: { email, challengeSlug, rewardLabel, rewardItems }
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const [admin] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (admin?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { email, challengeSlug, rewardLabel, rewardItems } = await req.json();
  if (!email || !challengeSlug || !rewardLabel || !rewardItems) {
    return NextResponse.json({ error: "email, challengeSlug, rewardLabel, rewardItems required" }, { status: 400 });
  }

  const result = await db.execute(sql`
    INSERT INTO challenge_reward_claims
      (user_id, challenge_member_id, challenge_slug, tier_min_completed, reward_label, reward_items)
    SELECT
      u.id,
      cm.id,
      ${challengeSlug},
      21,
      ${rewardLabel},
      ${rewardItems}
    FROM users u
    JOIN challenge_members cm ON cm.user_id = u.id
    JOIN challenges c ON c.id = cm.challenge_id AND c.slug = ${challengeSlug}
    WHERE lower(u.email) = lower(${email})
    ON CONFLICT (challenge_member_id) DO UPDATE SET
      reward_label = EXCLUDED.reward_label,
      reward_items = EXCLUDED.reward_items,
      tier_min_completed = EXCLUDED.tier_min_completed
    RETURNING id, user_id, challenge_slug, reward_label
  `);

  return NextResponse.json({ ok: true, granted: result });
}
