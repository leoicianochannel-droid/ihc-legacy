/**
 * Creates (or updates) the pinned welcome post in the community feed.
 * Posts as Ashley's admin account so it appears under her name.
 *
 * Re-running is safe — it removes any existing welcome post first.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { db, users, posts } from "@/lib/db";
import { eq, and, isNotNull, sql } from "drizzle-orm";

const WELCOME_BODY = `Welcome to the Infinity Hoop Community! 💫

We're so excited to have you here. I'm Ashley — your community manager — and the rest of the Infinity team is here to keep you motivated, answer questions, and make sure you feel supported every step of the way.

You've got access to everything: 200+ workouts, 29 high-protein recipes, the 6-week Infinity Challenge, the 2-Week Pre-Hoop program, and a community of 8,000+ women on the same path.

📌 START HERE
Open your dashboard — you'll see a "Getting Started" checklist with your first 6 tasks. Knock them out today and you'll know the platform inside-out.

🌟 COMMUNITY RULES
To keep this space safe, fun, and supportive for everyone:

• Judgment-Free Zone — No hate, bullying, or disrespect. We're here to lift each other up.
• Be Kind & Supportive — Encourage, motivate, and celebrate each other's wins, big or small.
• Stay on Topic — Share hooping wins, fitness tips, questions, and positive vibes.
• No Order/Support Questions — Need help? Email vip@infinityhoop.com. Support posts will be removed to keep this space focused on community.
• No Spam or Self-Promotion — No promoting personal products, services, or external links.
• Respect Privacy — Don't share screenshots or private conversations without permission.

Let's create an empowering space where everyone can thrive. Welcome aboard, and let's get spinning! 🌀💖`;

async function main() {
  // Find Ashley's admin user (or first admin)
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);

  if (!admin) {
    console.error("❌ No admin user found. Sign up with an email in ADMIN_EMAILS first.");
    process.exit(1);
  }

  console.log(`Using admin: ${admin.firstName ?? admin.email}`);

  // Remove any prior pinned welcome posts (so re-runs don't duplicate)
  const stale = await db
    .delete(posts)
    .where(
      and(
        eq(posts.userId, admin.id),
        isNotNull(posts.pinnedAt),
        sql`${posts.body} LIKE 'Welcome to the Infinity Hoop Community%'`
      )
    )
    .returning({ id: posts.id });
  if (stale.length) console.log(`  Cleared ${stale.length} prior welcome post(s)`);

  const [post] = await db
    .insert(posts)
    .values({
      userId: admin.id,
      category: "general",
      body: WELCOME_BODY,
      pinnedBy: admin.id,
      pinnedAt: new Date(),
    })
    .returning();

  console.log(`✅ Welcome post created (id: ${post.id.slice(0, 8)}…) and pinned to top of /community`);
}

main().catch(console.error).finally(() => process.exit(0));
