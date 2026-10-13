/**
 * Welcome-tour video configuration — stored in site_settings so admins can
 * swap the video URL via the UI without a code deploy.
 *
 * Keys:
 *   welcome_video_uid          Cloudflare Stream UID
 *   welcome_video_customer_code Cloudflare Stream customer subdomain (optional, branded URLs)
 *   welcome_video_duration_sec  optional, used to display "Watch the tour (X min)"
 *   welcome_video_embed_url     optional override — e.g. a Loom embed URL
 */
import "server-only";
import { db, siteSettings } from "./db";
import { eq, inArray, sql } from "drizzle-orm";

export const WELCOME_VIDEO_KEYS = [
  "welcome_video_uid",
  "welcome_video_customer_code",
  "welcome_video_duration_sec",
  "welcome_video_embed_url",
] as const;

export type WelcomeVideo = {
  uid: string;
  customerCode: string | null;
  durationSec: number | null;
  embedUrl: string | null;  // if set, used as the iframe src directly
};

export async function getWelcomeVideo(): Promise<WelcomeVideo | null> {
  const rows = await db
    .select()
    .from(siteSettings)
    .where(inArray(siteSettings.key, [...WELCOME_VIDEO_KEYS]));
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const uid = map.get("welcome_video_uid");
  const embedUrl = map.get("welcome_video_embed_url") ?? null;
  // Need at least a CF Stream UID or a direct embed URL
  if (!uid && !embedUrl) return null;
  const duration = map.get("welcome_video_duration_sec");
  return {
    uid: uid ?? "",
    customerCode: map.get("welcome_video_customer_code") ?? null,
    durationSec: duration ? parseInt(duration, 10) : null,
    embedUrl,
  };
}

export async function setWelcomeVideo(opts: {
  uid?: string;
  customerCode?: string | null;
  durationSec?: number | null;
  embedUrl?: string | null;
}) {
  const pairs: Array<[string, string | null]> = [
    ["welcome_video_uid", opts.uid ?? null],
    ["welcome_video_customer_code", opts.customerCode ?? null],
    ["welcome_video_duration_sec", opts.durationSec ? String(opts.durationSec) : null],
    ["welcome_video_embed_url", opts.embedUrl ?? null],
  ];
  for (const [key, value] of pairs) {
    await db
      .insert(siteSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value, updatedAt: sql`now()` },
      });
  }
}

export async function clearWelcomeVideo() {
  for (const key of WELCOME_VIDEO_KEYS) {
    await db.delete(siteSettings).where(eq(siteSettings.key, key));
  }
}
