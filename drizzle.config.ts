import type { Config } from "drizzle-kit";
import { config as loadEnv } from "dotenv";

// Load .env.local first (Next.js convention), fall back to .env
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

/**
 * Drizzle-kit doesn't handle Supabase pooler URLs well (the dot in the
 * username `postgres.xxxxx` breaks its URL parser). Parse the URL ourselves
 * and pass individual fields.
 */
function parse(raw: string) {
  const u = new URL(raw);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    database: u.pathname.replace(/^\//, "") || "postgres",
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl:
      u.hostname.includes("supabase") || u.hostname.includes("neon")
        ? ("require" as const)
        : undefined,
  };
}

const credentials = parse(process.env.DATABASE_URL!);

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: credentials,
  verbose: true,
  strict: true,
} satisfies Config;
