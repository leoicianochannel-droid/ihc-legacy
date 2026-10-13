import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db, workouts } from "@/lib/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * Mux webhook — fills in muxAssetId + muxPlaybackId once an upload finishes
 * encoding. We match by the upload id stored at creation time.
 *
 * Signature verification per:
 * https://docs.mux.com/core/listen-for-webhooks#verifying-webhook-signatures
 */
function verifyMux(secret: string, header: string | null, body: string) {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=")) as [string, string][]
  );
  if (!parts.t || !parts.v1) return false;
  const signed = `${parts.t}.${body}`;
  const expected = crypto.createHmac("sha256", secret).update(signed).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}

export async function POST(req: NextRequest) {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  const body = await req.text();

  if (secret) {
    const ok = verifyMux(secret, req.headers.get("mux-signature"), body);
    if (!ok) return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const event = JSON.parse(body);
  const type = event.type as string;

  try {
    if (type === "video.asset.ready") {
      const asset = event.data;
      const uploadId: string | undefined = asset.upload_id;
      const assetId: string = asset.id;
      const playbackId: string | undefined = asset.playback_ids?.[0]?.id;

      if (uploadId && playbackId) {
        // We stashed upload_id as muxAssetId pending → swap it out
        await db
          .update(workouts)
          .set({ muxAssetId: assetId, muxPlaybackId: playbackId })
          .where(eq(workouts.muxAssetId, uploadId));
      }
    }
  } catch (err) {
    console.error("Mux webhook handler error", err);
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
