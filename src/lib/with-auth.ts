import { NextRequest, NextResponse } from "next/server";
import { AuthUser, UserRole, ApiResponse } from "@/types";

export type AuthedRequest = NextRequest & { user: AuthUser };

type RouteHandler<T = unknown, P extends Record<string, string> = Record<string, string>> = (
  req: AuthedRequest,
  ctx: { params: Promise<P> },
) => Promise<NextResponse<ApiResponse<T>>>;

/**
 * Wraps a route handler, injecting the authenticated user parsed from
 * the headers that proxy.ts forwards after JWT verification.
 */
export function withAuth<T = unknown, P extends Record<string, string> = Record<string, string>>(
  handler: RouteHandler<T, P>,
) {
  return async (
    req: NextRequest,
    ctx: { params: Promise<P> },
  ): Promise<NextResponse<ApiResponse<T>>> => {
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role") as UserRole | null;
    const userEmail = req.headers.get("x-user-email");

    if (!userId || !userRole || !userEmail) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const authedReq = req as AuthedRequest;
    authedReq.user = { id: userId, role: userRole, email: userEmail, firstName: "", lastName: "" };

    return handler(authedReq, ctx);
  };
}

/**
 * requireRole — throws a 403 response if the user's role is not in the allowed list.
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

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * Cookie config for both access and refresh tokens.
 */
export const TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
