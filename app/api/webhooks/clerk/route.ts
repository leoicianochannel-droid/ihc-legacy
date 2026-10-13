import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { db, users, streaks, migrationRecords } from "@/lib/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * Clerk webhook — keeps our users table in sync with Clerk identity.
 * Events handled:
 *   - user.created → insert/update users row (promotes migrated rows by email)
 *   - user.updated → sync avatar, name changes
 *   - user.deleted → soft-delete by clearing clerkId
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "no_secret" }, { status: 500 });

  const svix_id = req.headers.get("svix-id");
  const svix_timestamp = req.headers.get("svix-timestamp");
  const svix_signature = req.headers.get("svix-signature");
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: "no_headers" }, { status: 400 });
  }

  const body = await req.text();
  let evt: any;
  try {
    const wh = new Webhook(secret);
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    console.error("Clerk webhook signature verification failed", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const { type, data } = evt;

  try {
    if (type === "user.created" || type === "user.updated") {
      const clerkId = data.id as string;
      const email = (data.email_addresses?.[0]?.email_address as string | undefined)?.toLowerCase();
      if (!email) return NextResponse.json({ ok: true });

      // Idempotency: if this clerkId is already in our system, just sync the profile.
      // This prevents duplicate-key errors when Clerk retries the same webhook.
      const [existingByClerkId] = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, clerkId))
        .limit(1);

      if (existingByClerkId) {
        await db
          .update(users)
          .set({
            firstName: data.first_name ?? existingByClerkId.firstName,
            lastName: data.last_name ?? existingByClerkId.lastName,
            avatarUrl: data.image_url ?? existingByClerkId.avatarUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingByClerkId.id));
        return NextResponse.json({ ok: true });
      }

      // New clerkId — check if there's a migrated user with this email to link
      const [existingByEmail] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingByEmail) {
        await db
          .update(users)
          .set({
            clerkId,
            firstName: data.first_name ?? existingByEmail.firstName,
            lastName: data.last_name ?? existingByEmail.lastName,
            avatarUrl: data.image_url ?? existingByEmail.avatarUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingByEmail.id));

        if (existingByEmail.migratedFromSkool) {
          await db
            .update(migrationRecords)
            .set({ activatedAt: new Date() })
            .where(eq(migrationRecords.userId, existingByEmail.id));
        }
      } else {
        // onConflictDoNothing as a last-resort safety net for tight race conditions
        const [u] = await db
          .insert(users)
          .values({
            clerkId,
            email,
            firstName: data.first_name,
            lastName: data.last_name,
            avatarUrl: data.image_url,
          })
          .onConflictDoNothing()
          .returning();
        if (u) {
          await db.insert(streaks).values({ userId: u.id }).onConflictDoNothing();
        }
      }
    }

    if (type === "user.deleted") {
      await db
        .update(users)
        .set({ clerkId: null })
        .where(eq(users.clerkId, data.id as string));
    }
  } catch (err) {
    console.error("Clerk webhook handler error", err);
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
