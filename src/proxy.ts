import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/jwt";
import { UserRole } from "@/types";

// Routes that require no authentication
const PUBLIC_ROUTES = ["/", "/track", "/api/tracking", "/api/auth", "/api/health", "/ws"];

// Routes restricted to ADMIN / STAFF (STAFF is checked at the handler level)
const ADMIN_ROUTES = ["/admin", "/api/admin", "/api/analytics", "/api/fleet", "/api/users"];

// Security headers applied to every response
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

function withSecurityHeaders(res: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, value);
  }
  return res;
}

// Next.js 16 requires the function to be named "proxy" (renamed from "middleware")
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes and static assets
  if (
    PUBLIC_ROUTES.some((r) => pathname.startsWith(r)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return withSecurityHeaders(NextResponse.next());
  }

  const token =
    request.cookies.get("access_token")?.value ??
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return withSecurityHeaders(
        NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
      );
    }
    return withSecurityHeaders(NextResponse.redirect(new URL("/login", request.url)));
  }

  try {
    const payload = verifyAccessToken(token);

    // Admin route guard — only ADMIN and STAFF may access these paths
    // Fine-grained role control (e.g. STAFF vs ADMIN) is enforced inside each handler
    if (
      ADMIN_ROUTES.some((r) => pathname.startsWith(r)) &&
      payload.role !== UserRole.ADMIN &&
      payload.role !== UserRole.STAFF
    ) {
      if (pathname.startsWith("/api/")) {
        return withSecurityHeaders(
          NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }),
        );
      }
      return withSecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)));
    }

    // Forward user info to route handlers via headers
    const headers = new Headers(request.headers);
    headers.set("x-user-id", payload.sub);
    headers.set("x-user-role", payload.role);
    headers.set("x-user-email", payload.email);

    return withSecurityHeaders(NextResponse.next({ request: { headers } }));
  } catch {
    if (pathname.startsWith("/api/")) {
      return withSecurityHeaders(
        NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 }),
      );
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("access_token");
    return withSecurityHeaders(response);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
