import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users, migrationRecords } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Deduplicate by source_email — the table has no unique constraint so the same
  // person can appear multiple times if the import script was run more than once.
  // We keep the earliest record per email (min id) and exclude anyone who has
  // activated on ANY of their rows.
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (source_email)
      COALESCE(resolved_email, source_email) AS email,
      source_email,
      invited_at,
      source
    FROM migration_records
    WHERE source_email NOT IN (
      SELECT source_email FROM migration_records WHERE activated_at IS NOT NULL
    )
    ORDER BY source_email, id ASC
  `);

  const lines = [
    "email,source_email,invited_at,source",
    ...(rows as Record<string, unknown>[]).map((r) => [
      r.email ?? r.source_email,
      r.source_email,
      r.invited_at ? new Date(r.invited_at as string).toISOString() : "",
      r.source,
    ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="not-joined-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
