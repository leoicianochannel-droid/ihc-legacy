import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const [admin] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (admin?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email param required" }, { status: 400 });

  const result = await db.execute(sql`
    SELECT
      u.id AS user_id,
      u.email,
      u.first_name,
      cm.id AS challenge_member_id,
      c.slug AS challenge_slug,
      c.title AS challenge_title,
      COUNT(DISTINCT cc.day_number) AS raw_checkin_count,
      cm.started_at,
      cm.completed_at
    FROM users u
    JOIN challenge_members cm ON cm.user_id = u.id
    JOIN challenges c ON c.id = cm.challenge_id
    LEFT JOIN challenge_checkins cc ON cc.challenge_member_id = cm.id
    WHERE lower(u.email) = lower(${email})
    GROUP BY u.id, u.email, u.first_name, cm.id, c.slug, c.title, cm.started_at, cm.completed_at
    ORDER BY cm.started_at DESC
  `);

  return NextResponse.json({ ok: true, rows: result });
}
