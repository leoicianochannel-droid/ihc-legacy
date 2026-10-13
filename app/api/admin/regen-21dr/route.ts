import { NextResponse } from "next/server";
import { db, workouts } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createDirectUpload } from "@/lib/mux";

// The 7 errored workout IDs
const FAILED = [
  { id: "18939d54-0294-4549-925b-cf6c4ad808eb", label: "Week 1, Workout 1" },
  { id: "df844e00-398e-4333-998b-bd1cb796c32f", label: "Week 1, Workout 2" },
  { id: "182061e4-b55d-4831-a492-6b81d73bc5c9", label: "Week 1, Workout 3" },
  { id: "45704542-7b99-47fa-9423-c053d1e50450", label: "Week 2, Workout 1" },
  { id: "5d5ce522-69f7-472a-843a-c73cd7b2a4fb", label: "Week 2, Workout 2" },
  { id: "a5953f12-43da-4aba-9417-a3629a9104fb", label: "Week 3, Workout 1" },
  { id: "157a7d29-8548-4eb2-8b0c-43ba8732c500", label: "Week 3, Workout 3" },
];

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.secret !== "ih21reset-regen") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const results = [];
  try {
    for (const w of FAILED) {
      const upload = await createDirectUpload({});
      await db
        .update(workouts)
        .set({ muxAssetId: upload.id })
        .where(eq(workouts.id, w.id));
      results.push({ label: w.label, workoutId: w.id, uploadId: upload.id, uploadUrl: upload.url });
    }
  } catch (err) {
    console.error("regen-21dr error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, uploads: results });
}
