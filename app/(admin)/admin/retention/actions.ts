"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createNotification } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";

async function assertAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("not authenticated");
  const [me] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (me?.role !== "admin") throw new Error("forbidden");
}

export async function sendNudge(memberId: string, memberEmail: string | null, memberFirstName: string | null) {
  await assertAdmin();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ihcommunity.com";
  const name = memberFirstName ?? "there";

  await createNotification(memberId, {
    type: "system",
    title: "We miss you! 💕",
    body: "Your community is waiting — come check in, log a workout, or say hi to your buddy.",
    actionUrl: "/dashboard",
  });

  if (memberEmail) {
    await sendEmail({
      to: memberEmail,
      subject: "We've been thinking about you 💕",
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
          <p style="font-size:22px;font-weight:700;margin:0 0 16px">Hey ${name}! 👋</p>
          <p style="font-size:15px;color:#444;margin:0 0 16px;line-height:1.6">
            We noticed you haven't been around in a little while — and we just wanted to check in.
            Your community is here, your workouts are waiting, and your accountability buddy would love to hear from you.
          </p>
          <p style="font-size:15px;color:#444;margin:0 0 24px;line-height:1.6">
            Even 15 minutes of movement today can turn things around. You've got this. 💪
          </p>
          <a href="${appUrl}/dashboard"
             style="display:inline-block;background:#d10352;color:#fff;padding:14px 28px;border-radius:28px;text-decoration:none;font-weight:700;font-size:15px">
            Come back to the community →
          </a>
          <p style="font-size:13px;color:#999;margin-top:32px">
            — The Infinity Hoop team
          </p>
        </div>`,
    });
  }

  revalidatePath("/admin/retention");
  return { ok: true };
}
