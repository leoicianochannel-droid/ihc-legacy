import { db, users } from "../lib/db";
import { eq, sql } from "drizzle-orm";

async function main() {
  const email = process.argv[2]?.toLowerCase();
  if (!email) {
    console.error("Usage: tsx scripts/grant-admin.ts <email>");
    process.exit(1);
  }

  const [existing] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  if (!existing) {
    console.error(`No user found with email ${email}. They need to sign up first.`);
    process.exit(2);
  }

  if (existing.role === "admin") {
    console.log(
      `${existing.firstName ?? ""} ${existing.lastName ?? ""} (${existing.email}) is already an admin.`
    );
    process.exit(0);
  }

  await db.update(users).set({ role: "admin" }).where(eq(users.id, existing.id));
  console.log(
    `Promoted ${existing.firstName ?? ""} ${existing.lastName ?? ""} (${existing.email}) to admin.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
