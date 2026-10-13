import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_INVITE_COOKIE,
  validateInvite,
} from "@/lib/admin-invites";

/**
 * Receives the public invite link `/admin-join/<token>`.
 *
 * Why a Route Handler instead of a Server Component page? In Next.js 16+
 * mutating cookies during a Server Component render throws — they can only
 * be written in Route Handlers or Server Actions. So this handler validates
 * the token, drops it into an httpOnly cookie via the response, and redirects
 * to /admin-join where the friendly welcome UI lives. Validation happens
 * here AND on the welcome page so the cookie is never set for an invalid
 * token.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const invite = await validateInvite(token);

  if (!invite) {
    return NextResponse.redirect(new URL("/admin-join?error=invalid", req.url));
  }

  const res = NextResponse.redirect(new URL("/admin-join", req.url));
  res.cookies.set(ADMIN_INVITE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 2, // 2 hours
    path: "/",
  });
  return res;
}
