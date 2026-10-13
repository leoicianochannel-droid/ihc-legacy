/**
 * Source of truth for the public app URL.
 *
 * Why a helper instead of inlining `process.env.NEXT_PUBLIC_APP_URL ?? ...`?
 * Because `??` only falls back when the value is null/undefined — but Vercel
 * has historically allowed empty-string env vars, which would slip past `??`
 * and produce broken share links. This function treats empty/whitespace
 * values the same as missing.
 */
const FALLBACK = "https://infinity-hoop-community-green.vercel.app";

export function getAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return FALLBACK;
  // Strip a trailing slash so callers can confidently do `${url}/path`
  return raw.replace(/\/$/, "");
}
