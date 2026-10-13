/**
 * Cloudflare Stream API helpers.
 *
 * Stream uses a "direct creator upload" flow similar to Mux:
 *   1. Create a one-time upload URL via API
 *   2. Client (or server) uploads the file to that URL
 *   3. Cloudflare encodes asynchronously
 *   4. Poll status via /stream/{uid} OR receive a webhook when ready
 *
 * Playback URLs:
 *   - HLS:    https://customer-{CODE}.cloudflarestream.com/{uid}/manifest/video.m3u8
 *   - iframe: https://customer-{CODE}.cloudflarestream.com/{uid}/iframe
 *   - thumb:  https://customer-{CODE}.cloudflarestream.com/{uid}/thumbnails/thumbnail.jpg
 */

function getCreds() {
  const accountId = process.env.CF_STREAM_ACCOUNT_ID ?? "";
  const apiToken = process.env.CF_STREAM_API_TOKEN ?? "";
  if (!accountId || !apiToken) {
    throw new Error("CF_STREAM_ACCOUNT_ID / CF_STREAM_API_TOKEN not configured");
  }
  return {
    accountId,
    apiToken,
    apiBase: `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`,
  };
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export type CFStreamVideo = {
  uid: string;
  status: { state: "queued" | "inprogress" | "ready" | "error"; pctComplete?: string };
  meta?: Record<string, string>;
  duration?: number;
  thumbnail?: string;
  playback?: { hls: string; dash: string };
  preview?: string;
  readyToStream?: boolean;
  size?: number;
  // Customer subdomain code (for branded URLs)
  // Cloudflare returns playback URLs containing it; we extract from there.
  created?: string;
};

/**
 * Create a direct upload URL for a single video.
 * Pass `maxDurationSeconds` to set the max length you'll allow (Stream
 * cancels uploads exceeding this — defaults to 6 hours which covers anything).
 */
export async function createDirectUpload(opts: {
  maxDurationSeconds?: number;
  meta?: Record<string, string>;
  expirySeconds?: number;
} = {}): Promise<{ uid: string; uploadURL: string }> {
  const { apiBase, apiToken } = getCreds();

  const maxDuration = opts.maxDurationSeconds ?? 21_600; // 6 hours
  const expiry = new Date(Date.now() + (opts.expirySeconds ?? 60 * 60) * 1000).toISOString();

  const res = await fetch(`${apiBase}/direct_upload`, {
    method: "POST",
    headers: { ...authHeaders(apiToken), "Content-Type": "application/json" },
    body: JSON.stringify({
      maxDurationSeconds: maxDuration,
      expiry,
      meta: opts.meta,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`CF Stream direct_upload failed: ${res.status} ${err}`);
  }

  const json = await res.json();
  return {
    uid: json.result.uid,
    uploadURL: json.result.uploadURL,
  };
}

export async function getVideo(uid: string): Promise<CFStreamVideo | null> {
  const { apiBase, apiToken } = getCreds();
  const res = await fetch(`${apiBase}/${uid}`, { headers: authHeaders(apiToken) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`CF Stream getVideo failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.result as CFStreamVideo;
}

export async function deleteVideo(uid: string): Promise<void> {
  const { apiBase, apiToken } = getCreds();
  const res = await fetch(`${apiBase}/${uid}`, { method: "DELETE", headers: authHeaders(apiToken) });
  if (!res.ok && res.status !== 404) {
    throw new Error(`CF Stream deleteVideo failed: ${res.status} ${await res.text()}`);
  }
}

/** Extract the customer subdomain code from a playback URL. */
export function customerCodeFromPlayback(playbackUrl: string | undefined): string | null {
  if (!playbackUrl) return null;
  const m = playbackUrl.match(/customer-([a-z0-9]+)\.cloudflarestream\.com/);
  return m ? m[1] : null;
}

/** Branded iframe URL (uses your customer subdomain so it's not "videodelivery.net"). */
export function iframeUrl(uid: string, customerCode: string | null): string {
  if (customerCode) {
    return `https://customer-${customerCode}.cloudflarestream.com/${uid}/iframe`;
  }
  return `https://iframe.videodelivery.net/${uid}`;
}

export function thumbnailUrl(
  uid: string,
  customerCode: string | null,
  opts: { time?: string; width?: number } = {}
): string {
  const params = new URLSearchParams();
  if (opts.time) params.set("time", opts.time);
  if (opts.width) params.set("width", String(opts.width));
  const qs = params.toString();
  const base = customerCode
    ? `https://customer-${customerCode}.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg`
    : `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`;
  return qs ? `${base}?${qs}` : base;
}

export function hlsManifestUrl(uid: string, customerCode: string | null): string {
  return customerCode
    ? `https://customer-${customerCode}.cloudflarestream.com/${uid}/manifest/video.m3u8`
    : `https://videodelivery.net/${uid}/manifest/video.m3u8`;
}

/**
 * Request auto-generated English captions for a video.
 * Safe to call multiple times — CF is idempotent.
 */
export async function requestCaptions(uid: string): Promise<void> {
  const { apiBase, apiToken } = getCreds();
  await fetch(`${apiBase}/${uid}/captions/en`, {
    method: "PUT",
    headers: { ...authHeaders(apiToken), "Content-Type": "application/json" },
    body: JSON.stringify({ label: "English", generated: true }),
  });
}

/**
 * Fetch the VTT caption file for a video.
 * Returns null if captions are not ready yet.
 */
export async function fetchCaptionsVtt(uid: string): Promise<string | null> {
  const { apiBase, apiToken } = getCreds();
  const res = await fetch(`${apiBase}/${uid}/captions/en/vtt`, {
    headers: authHeaders(apiToken),
  });
  if (!res.ok) return null;
  return res.text();
}

type Segment = { t: number; text: string };

/** Parse a WebVTT string into timestamped segments. */
export function parseVtt(vtt: string): Segment[] {
  const segments: Segment[] = [];
  const blocks = vtt.split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    // Find the timestamp line: "00:00:01.000 --> 00:00:03.000"
    const tsLine = lines.find((l) => l.includes("-->"));
    if (!tsLine) continue;
    const [start] = tsLine.split("-->");
    const t = vttTimeToSeconds(start.trim());
    // Text is everything after the timestamp line (skip cue identifier lines)
    const textLines = lines.slice(lines.indexOf(tsLine) + 1).filter(Boolean);
    const text = textLines.join(" ").replace(/<[^>]+>/g, "").trim();
    if (text) segments.push({ t, text });
  }
  return segments;
}

function vttTimeToSeconds(ts: string): number {
  const parts = ts.split(":").map(parseFloat);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}
