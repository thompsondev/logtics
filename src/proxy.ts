import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/jwt";
import { UserRole } from "@/types";

// Routes that require no authentication.
// IMPORTANT: do NOT include bare "/" here — startsWith("/") matches every
// path, which would bypass auth on every route including /dashboard and /admin.
// The root path is matched with an exact check further down.
const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/track",
  "/api/tracking",
  "/api/auth",
  "/api/health",
  "/ws",
];

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
  // CSP — restrict resource origins; tighten script-src once inline scripts are eliminated
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js needs unsafe-eval in dev
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
};

// Allowed CORS origins — extend via ALLOWED_ORIGINS env var (comma-separated)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function applyHeaders(req: NextRequest, res: NextResponse): NextResponse {
  // Security headers
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, value);
  }

  // CORS — only echo the origin when it's explicitly allow-listed
  const origin = req.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type,Authorization,X-Requested-With",
    );
    res.headers.set("Vary", "Origin");
  }

  return res;
}

// Next.js 16 requires the function to be named "proxy" (renamed from "middleware")
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle CORS preflight before any auth checks
  if (request.method === "OPTIONS") {
    return applyHeaders(request, new NextResponse(null, { status: 204 }));
  }

  // Allow public routes and static assets
  if (
    pathname === "/" ||                                          // exact root
    PUBLIC_PREFIXES.some((r) => pathname.startsWith(r)) ||     // public prefixes
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return applyHeaders(request, NextResponse.next());
  }

  const token =
    request.cookies.get("access_token")?.value ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return applyHeaders(
        request,
        NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
      );
    }
    return applyHeaders(request, NextResponse.redirect(new URL("/login", request.url)));
  }

  try {
    const payload = verifyAccessToken(token);

    // Admin route guard — only ADMIN and STAFF may proceed
    // Fine-grained role control (STAFF vs ADMIN) is enforced inside each handler
    if (
      ADMIN_ROUTES.some((r) => pathname.startsWith(r)) &&
      payload.role !== UserRole.ADMIN &&
      payload.role !== UserRole.STAFF
    ) {
      if (pathname.startsWith("/api/")) {
        return applyHeaders(
          request,
          NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }),
        );
      }
      return applyHeaders(request, NextResponse.redirect(new URL("/dashboard", request.url)));
    }

    // Forward identity hints to route handlers.
    // NOTE: withAuth re-verifies the JWT independently — these headers are
    // informational hints only and are never trusted as the sole auth source.
    const headers = new Headers(request.headers);
    headers.set("x-user-id", payload.sub);
    headers.set("x-user-role", payload.role);
    headers.set("x-user-email", payload.email);

    return applyHeaders(request, NextResponse.next({ request: { headers } }));
  } catch {
    if (pathname.startsWith("/api/")) {
      return applyHeaders(
        request,
        NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 }),
      );
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("access_token");
    return applyHeaders(request, response);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
