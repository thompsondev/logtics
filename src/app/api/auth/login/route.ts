import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db";
import { AuthService } from "@/modules/auth/auth.service";
import { LoginDto } from "@/modules/auth/dtos/auth.dto";
import { ok, badRequest, unauthorized, serverError } from "@/lib/api-response";
import {
  TOKEN_COOKIE_OPTIONS,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  getClientIp,
} from "@/lib/with-auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // 10 login attempts per minute per IP — brute-force protection
  const throttled = await rateLimit(req, { prefix: "auth:login", windowSec: 60, max: 10 });
  if (throttled) return throttled;

  try {
    const body = await req.json();
    const parsed = LoginDto.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map((i) => i.message).join(", "));
    }

    const ds = await getDataSource();
    const service = new AuthService(ds);
    const result = await service.login(parsed.data, getClientIp(req));

    const response = ok(result);
    response.cookies.set(ACCESS_TOKEN_COOKIE, result.tokens.accessToken, {
      ...TOKEN_COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60,
    });
    response.cookies.set(REFRESH_TOKEN_COOKIE, result.tokens.refreshToken, {
      ...TOKEN_COOKIE_OPTIONS,
      maxAge: 30 * 24 * 60 * 60,
    });
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    if (message === "Invalid credentials") return unauthorized(message);
    if (message === "Account is deactivated") return unauthorized(message);
    return serverError(message);
  }
}
