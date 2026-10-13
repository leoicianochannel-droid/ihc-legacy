import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/**
 * Parse a Postgres connection URL into separate fields.
 *
 * Why not just pass the URL to postgres.js? Because postgres.js's URL parser
 * mishandles usernames that contain a dot (Supabase pooler uses usernames
 * like `postgres.xdjxwvznfswmshpprkqo` to route to the right project). The
 * built-in URL class parses it correctly — we use that and then pass individual
 * fields to postgres.js, which works every time.
 */
function parsePgUrl(raw: string) {
  const u = new URL(raw);
  const params = Object.fromEntries(u.searchParams);
  const ssl: "require" | false | undefined =
    params.sslmode === "disable"
      ? false
      : params.sslmode === "require" ||
        u.hostname.includes("supabase") ||
        u.hostname.includes("neon")
      ? "require"
      : undefined;
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    database: u.pathname.replace(/^\//, "") || "postgres",
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl,
  };
}

function createDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in."
    );
  }

  const opts = parsePgUrl(process.env.DATABASE_URL);

  // `prepare: false` is required for Supabase's Transaction-mode pooler.
  const client = postgres({
    ...opts,
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(client, { schema });
}

// Lazy singleton — avoids throwing during module import / Next.js build.
let _db: ReturnType<typeof createDb> | null = null;

export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    if (!_db) _db = createDb();
    return (_db as any)[prop];
  },
});

export type Database = ReturnType<typeof createDb>;
export * from "./schema";
