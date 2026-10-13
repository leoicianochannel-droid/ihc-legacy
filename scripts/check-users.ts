import { config } from "dotenv";
config({ path: ".env.local" });
import { db, users } from "@/lib/db";

async function main() {
  const list = await db.select().from(users);
  console.log(`Total users: ${list.length}\n`);
  for (const u of list) {
    console.log(
      `${u.email}  |  role: ${u.role}  |  onboarded: ${u.onboardedAt ? "yes" : "no"}  |  clerkId: ${u.clerkId?.slice(0, 20) ?? "none"}`
    );
  }
}

main().catch(console.error).finally(() => process.exit(0));
