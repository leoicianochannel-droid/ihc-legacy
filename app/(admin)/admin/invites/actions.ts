"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, adminInvites } from "@/lib/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { generateInviteToken } from "@/lib/admin-invites";

async function assertAdmin() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("not_authenticated");
  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (me?.role !== "admin") throw new Error("forbidden");
  return me;
}

export async function createAdminInvite(formData: FormData) {
  const me = await assertAdmin();

  const label = String(formData.get("label") ?? "").trim().slice(0, 200) || null;
  const maxUsesRaw = String(formData.get("maxUses") ?? "").trim();
  const expiresInDaysRaw = String(formData.get("expiresInDays") ?? "").trim();

  // maxUses: empty / "unlimited" → null. Otherwise a positive int.
  let maxUses: number | null = null;
  if (maxUsesRaw && maxUsesRaw !== "unlimited") {
    const n = parseInt(maxUsesRaw, 10);
    if (!Number.isNaN(n) && n > 0) maxUses = n;
  }

  // Expiry: blank / "never" → null. Otherwise a positive int (days from now).
  let expiresAt: Date | null = null;
  if (expiresInDaysRaw && expiresInDaysRaw !== "never") {
    const days = parseInt(expiresInDaysRaw, 10);
    if (!Number.isNaN(days) && days > 0) {
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
  }

  await db.insert(adminInvites).values({
    token: generateInviteToken(),
    label,
    createdById: me.id,
    maxUses,
    expiresAt,
  });

  revalidatePath("/admin/invites");
}

export async function revokeAdminInvite(inviteId: string) {
  await assertAdmin();
  await db
    .update(adminInvites)
    .set({ revokedAt: new Date() })
    .where(eq(adminInvites.id, inviteId));
  revalidatePath("/admin/invites");
}
