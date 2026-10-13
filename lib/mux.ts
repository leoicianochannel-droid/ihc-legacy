import Mux from "@mux/mux-node";

if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
  console.warn("Mux credentials not set — video upload/playback will be disabled.");
}

export const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID ?? "",
  tokenSecret: process.env.MUX_TOKEN_SECRET ?? "",
});

/** Upload-and-ingest: returns a direct upload URL that the admin client POSTs the video file to. */
export async function createDirectUpload(params: {
  corsOrigin?: string;
  test?: boolean;
}) {
  return mux.video.uploads.create({
    cors_origin: params.corsOrigin ?? process.env.NEXT_PUBLIC_APP_URL ?? "*",
    new_asset_settings: {
      playback_policy: ["public"],             // switch to ["signed"] for paywall gating
      encoding_tier: "smart",
      max_resolution_tier: "1080p",
      mp4_support: "standard",
    },
    test: params.test,
  });
}

export function muxThumbnail(playbackId: string, opts?: { time?: number; width?: number }) {
  const params = new URLSearchParams();
  if (opts?.time !== undefined) params.set("time", String(opts.time));
  if (opts?.width) params.set("width", String(opts.width));
  const qs = params.toString();
  return `https://image.mux.com/${playbackId}/thumbnail.webp${qs ? `?${qs}` : ""}`;
}

export function muxAnimatedThumbnail(playbackId: string) {
  return `https://image.mux.com/${playbackId}/animated.webp?width=640&fps=15`;
}
