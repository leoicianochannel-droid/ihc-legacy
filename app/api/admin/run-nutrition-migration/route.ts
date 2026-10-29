import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

export async function POST() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [admin] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (admin?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meal_type') THEN
        CREATE TYPE meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS nutrition_goals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      calories INTEGER NOT NULL DEFAULT 2000,
      protein_g INTEGER NOT NULL DEFAULT 150,
      carbs_g INTEGER NOT NULL DEFAULT 200,
      fat_g INTEGER NOT NULL DEFAULT 65,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS food_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      meal_type meal_type NOT NULL,
      food_name TEXT NOT NULL,
      calories INTEGER NOT NULL,
      protein_g REAL NOT NULL DEFAULT 0,
      carbs_g REAL NOT NULL DEFAULT 0,
      fat_g REAL NOT NULL DEFAULT 0,
      serving_desc TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS food_log_user_date_idx ON food_log(user_id, date);
  `);

  return NextResponse.json({ ok: true });
}
