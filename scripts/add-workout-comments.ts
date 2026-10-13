import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  await sql`
    CREATE TABLE IF NOT EXISTS workout_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS workout_comments_workout_created_idx
    ON workout_comments(workout_id, created_at)
  `;

  console.log("✓ created workout_comments table");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
