/**
 * Migrate Skool community members to Infinity Hoop platform.
 *
 * Reads community_members.csv (exported from Skool) and:
 *   1. Resolves the correct email (usually in Answer1, NOT the Email column —
 *      Skool uses the Email column for the sign-up email, but they ask members
 *      "what email did you use to purchase?" in Q1 which is the real one).
 *   2. Creates a migration_records row with the source data.
 *   3. (Optional) Creates a Clerk invitation — skipped here, handled by the
 *      admin UI "Send invites" step so you can stage + review first.
 *   4. Inserts a users row with onboarding answers pre-populated.
 *
 * Idempotent: running twice is safe. Skips rows already migrated.
 *
 * Usage:   npm run migrate:skool -- --file /path/to/community_members.csv [--dry-run] [--limit 100]
 */

import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";
import { db, users, migrationRecords, streaks } from "@/lib/db";
import { eq } from "drizzle-orm";

type SkoolRow = {
  FirstName: string;
  LastName: string;
  Email: string;
  "Invited By": string;
  JoinedDate: string;
  Question1: string; Answer1: string;
  Question2: string; Answer2: string;
  Question3: string; Answer3: string;
  Price: string;
  "Recurring Interval": string;
  Tier: string;
  LTV: string;
};

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : def;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

function normEmail(s: string | undefined): string | null {
  if (!s) return null;
  const match = s.trim().match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
  return match ? match[0].toLowerCase() : null;
}

function resolveEmail(row: SkoolRow): string | null {
  // Priority: Answer1 (purchase email) → Email column
  return (
    normEmail(row.Answer1) ??
    normEmail(row.Email) ??
    null
  );
}

function parseAge(answer2: string | undefined): number | null {
  if (!answer2) return null;
  const m = answer2.match(/\b(\d{2})\b/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 13 && n <= 100 ? n : null;
}

function parseCheckInStyle(answer3: string | undefined): "fun" | "soft" | "accountability" | null {
  if (!answer3) return null;
  const lower = answer3.toLowerCase();
  if (/\b(soft|chill|kind|gentle|supportive)\b/.test(lower)) return "soft";
  if (/\b(tough|strict|firm|push|accountability|honest)\b/.test(lower)) return "accountability";
  if (/\b(fun|play|chatty|cheerlead|encour|hype)\b/.test(lower)) return "fun";
  return null;
}

async function main() {
  const file = arg("file", "/Users/ashleybintner/Desktop/community_members.csv")!;
  const dryRun = hasFlag("dry-run");
  const limitArg = arg("limit");
  const limit = limitArg ? parseInt(limitArg, 10) : Infinity;

  if (!fs.existsSync(file)) {
    console.error(`CSV not found at ${file}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(file, "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as SkoolRow[];

  console.log(`Loaded ${rows.length} rows from ${path.basename(file)}`);
  if (dryRun) console.log("🧪 DRY RUN — nothing will be written.");

  // Pre-load all existing emails in ONE query instead of N per-row lookups
  console.log("Fetching existing users from DB...");
  const existingRows = await db.select({ email: users.email }).from(users);
  const existingEmails = new Set(existingRows.map((u) => u.email).filter(Boolean));
  console.log(`  ${existingEmails.size} users already in DB`);

  let inserted = 0;
  let skipped = 0;
  let noEmail = 0;

  for (let i = 0; i < Math.min(rows.length, limit); i++) {
    const row = rows[i];
    const email = resolveEmail(row);
    if (!email) {
      noEmail++;
      continue;
    }

    // Already migrated? (in-memory check — no extra DB round-trip)
    if (existingEmails.has(email)) {
      skipped++;
      continue;
    }

    const age = parseAge(row.Answer2);
    const workoutPreferences = row.Answer2?.trim() || null;
    const idealBuddyWords = row.Answer3?.trim() || null;
    const checkInStyle = parseCheckInStyle(row.Answer3);

    if (dryRun) {
      inserted++;
      continue;
    }

    await db.transaction(async (tx) => {
      // onConflictDoNothing handles the race where a Skio webhook inserts
      // this email between our initial bulk-load and this insert.
      const [u] = await tx
        .insert(users)
        .values({
          email,
          firstName: row.FirstName?.trim() || null,
          lastName: row.LastName?.trim() || null,
          purchaseEmail: email,
          age,
          workoutPreferences,
          idealBuddyWords,
          checkInStyle: checkInStyle ?? "fun",
          migratedFromSkool: true,
          skoolJoinedAt: row.JoinedDate ? new Date(row.JoinedDate) : null,
          // onboardedAt intentionally null — they'll be taken through a short
          // welcome flow on first login to complete remaining fields.
        })
        .onConflictDoNothing()
        .returning();

      // u is undefined if the row was skipped due to conflict — bail out of tx
      if (!u) return;

      await tx.insert(streaks).values({ userId: u.id });

      await tx.insert(migrationRecords).values({
        sourceEmail: row.Email?.trim() || email,
        resolvedEmail: email,
        sourceData: row as unknown as Record<string, string>,
        userId: u.id,
        source: "skool",
      });
    });

    inserted++;
    if (inserted % 100 === 0) console.log(`...${inserted} inserted`);
  }

  console.log(`\n✅ Migration complete`);
  console.log(`   Inserted:  ${inserted}`);
  console.log(`   Skipped:   ${skipped} (already in DB)`);
  console.log(`   No email:  ${noEmail}`);
  if (dryRun) console.log(`   (dry run — no writes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
