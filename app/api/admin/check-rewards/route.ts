import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const [admin] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (admin?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const rows = await db.execute(sql`
      SELECT crc.challenge_slug, crc.reward_label, crc.earned_at, crc.shipped_at,
             u.first_name, u.last_name, u.email
      FROM challenge_reward_claims crc
      JOIN users u ON u.id = crc.user_id
      ORDER BY crc.earned_at DESC
      LIMIT 50
    `);
    return NextResponse.json({ ok: true, count: rows.length, rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) });
  }
}
