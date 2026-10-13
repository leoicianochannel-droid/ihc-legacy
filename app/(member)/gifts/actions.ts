"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, giftClaims } from "@/lib/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getGiftStatus, daysSince, getDbMilestones, type MilestoneKey } from "@/lib/gifts";
import { sendEmail } from "@/lib/email";

export async function claimGift(formData: FormData) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { error: "Not authenticated" };

  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) return { error: "User not found" };

  const milestoneKey = formData.get("milestoneKey") as MilestoneKey;
  const allMilestones = await getDbMilestones();
  const milestone = allMilestones.find((m) => m.key === milestoneKey);
  if (!milestone) return { error: "Invalid milestone" };

  // Verify they've actually earned it
  const startDate = me.onboardedAt ?? me.createdAt;
  const days = daysSince(startDate);
  if (days < milestone.dayThreshold) {
    return { error: "You haven't reached this milestone yet" };
  }

  // Check if already claimed
  const [existing] = await db
    .select()
    .from(giftClaims)
    .where(eq(giftClaims.userId, me.id))
    .limit(1);
  // Check for this specific milestone
  const existingClaims = await db.select().from(giftClaims).where(eq(giftClaims.userId, me.id));
  const alreadyClaimed = existingClaims.find(
    (c) => c.milestoneKey === milestoneKey && c.claimedAt
  );
  if (alreadyClaimed) return { error: "Already claimed" };

  const shippingName = formData.get("shippingName") as string;
  const shippingLine1 = formData.get("shippingLine1") as string;
  const shippingLine2 = formData.get("shippingLine2") as string | null;
  const shippingCity = formData.get("shippingCity") as string;
  const shippingState = formData.get("shippingState") as string;
  const shippingZip = formData.get("shippingZip") as string;
  const shippingCountry = (formData.get("shippingCountry") as string) || "US";

  if (milestone.requiresShipping) {
    if (!shippingName || !shippingLine1 || !shippingCity || !shippingState || !shippingZip) {
      return { error: "Please fill in all required shipping fields" };
    }
  }

  // Upsert claim row
  await db
    .insert(giftClaims)
    .values({
      userId: me.id,
      milestoneKey,
      unlockedAt: new Date(),
      claimedAt: new Date(),
      shippingName: milestone.requiresShipping ? shippingName : null,
      shippingLine1: milestone.requiresShipping ? shippingLine1 : null,
      shippingLine2: milestone.requiresShipping ? shippingLine2 : null,
      shippingCity: milestone.requiresShipping ? shippingCity : null,
      shippingState: milestone.requiresShipping ? shippingState : null,
      shippingZip: milestone.requiresShipping ? shippingZip : null,
      shippingCountry: milestone.requiresShipping ? shippingCountry : null,
    })
    .onConflictDoUpdate({
      target: [giftClaims.userId, giftClaims.milestoneKey],
      set: {
        claimedAt: new Date(),
        shippingName: milestone.requiresShipping ? shippingName : null,
        shippingLine1: milestone.requiresShipping ? shippingLine1 : null,
        shippingLine2: milestone.requiresShipping ? shippingLine2 : null,
        shippingCity: milestone.requiresShipping ? shippingCity : null,
        shippingState: milestone.requiresShipping ? shippingState : null,
        shippingZip: milestone.requiresShipping ? shippingZip : null,
        shippingCountry: milestone.requiresShipping ? shippingCountry : null,
      },
    });

  // Notify admin by email
  const adminEmail = process.env.ADMIN_EMAILS?.split(",")[0]?.trim();
  if (adminEmail) {
    const shippingBlock = milestone.requiresShipping
      ? `
        <p><strong>Ship to:</strong><br/>
        ${shippingName}<br/>
        ${shippingLine1}${shippingLine2 ? "<br/>" + shippingLine2 : ""}<br/>
        ${shippingCity}, ${shippingState} ${shippingZip}<br/>
        ${shippingCountry}</p>
      `
      : "<p><em>No shipping needed — apply free month to account.</em></p>";

    sendEmail({
      to: adminEmail,
      subject: `🎁 Gift claim: ${milestone.fullLabel} — ${me.firstName} ${me.lastName ?? ""}`,
      html: `
        <h2>Gift Milestone Claimed</h2>
        <p><strong>Member:</strong> ${me.firstName} ${me.lastName ?? ""} (${me.email})</p>
        <p><strong>Gift:</strong> ${milestone.emoji} ${milestone.fullLabel}</p>
        <p><strong>Milestone:</strong> Day ${milestone.dayThreshold} (${me.firstName} has been a member for ${days} days)</p>
        ${shippingBlock}
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/admin">View in Admin →</a></p>
      `,
    }).catch(console.warn);
  }

  revalidatePath("/gifts");
  revalidatePath("/");
  return { success: true };
}
