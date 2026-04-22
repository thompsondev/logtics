import { NextRequest, NextResponse } from "next/server";
import { AuthUser, UserRole, ApiResponse } from "@/types";
import { verifyAccessToken } from "@/lib/jwt";
import { isAccessTokenBlocked } from "@/lib/redis";

export type AuthedRequest = NextRequest & { user: AuthUser };

type RouteHandler<T = unknown, P extends Record<string, string> = Record<string, string>> = (
  req: AuthedRequest,
  ctx: { params: Promise<P> },
) => Promise<NextResponse<ApiResponse<T>>>;

/**
 * Wraps a route handler and performs independent JWT verification.
 *
 * ⚠️  We intentionally re-verify the JWT here rather than trusting the
 * x-user-* headers forwarded by proxy.ts.  If a request somehow reaches an
 * API route without going through the proxy (e.g. direct internal calls,
 * misconfigured CDN, tests), the proxy headers are trivially forgeable.
 * Verifying the token at the edge AND inside the handler gives us defence in
 * depth with negligible overhead (jwt.verify is ~1ms synchronous).
 */
export function withAuth<T = unknown, P extends Record<string, string> = Record<string, string>>(
  handler: RouteHandler<T, P>,
) {
  return async (
    req: NextRequest,
    ctx: { params: Promise<P> },
  ): Promise<NextResponse<ApiResponse<T>>> => {
    const token =
      req.cookies.get(ACCESS_TOKEN_COOKIE)?.value ??
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return NextResponse.json({ success: false, error: "Invalid or expired token" }, { status: 401 });
    }

    // Check blocklist (handles logout token invalidation)
    if (payload.jti) {
      try {
        const blocked = await isAccessTokenBlocked(payload.jti);
        if (blocked) {
          return NextResponse.json({ success: false, error: "Token has been revoked" }, { status: 401 });
        }
      } catch {
        // Redis unavailable — fail open; the JWT signature is still valid
      }
    }

    const authedReq = req as AuthedRequest;
    authedReq.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
      firstName: "",
      lastName: "",
    };

    return handler(authedReq, ctx);
  };
}

/**
 * requireRole — returns a 403 response if the user's role is not allowed.
 * Call inside a withAuth-wrapped handler.
 */
export function requireRole(
  user: AuthUser,
  ...roles: UserRole[]
): NextResponse<ApiResponse> | null {
  if (!roles.includes(user.role)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/**
 * Extract the true client IP.  In a proxied setup the FIRST hop in
 * X-Forwarded-For is attacker-controlled; the LAST hop is set by the
 * load balancer / CDN and is trustworthy.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((h) => h.trim());
    return hops[hops.length - 1] ?? "unknown";
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Cookie options for the short-lived access token.
 */
export const TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/**
 * Cookie options for the long-lived refresh token.
 * Uses sameSite: "strict" to prevent CSRF on the /api/auth/refresh endpoint.
 */
export const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/auth/refresh",  // scope to the refresh endpoint only
};

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
