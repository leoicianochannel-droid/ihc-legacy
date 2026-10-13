import { NextResponse } from "next/server";
import { rematchGhostedBuddies } from "@/lib/buddy-matching";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await rematchGhostedBuddies();
  return NextResponse.json({ ok: true, ...result });
}
