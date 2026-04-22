import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/db";
import { AuthService } from "@/modules/auth/auth.service";
import { RegisterDto } from "@/modules/auth/dtos/auth.dto";
import { UserRole } from "@/types";
import {
  created,
  badRequest,
  serverError,
} from "@/lib/api-response";
import {
  TOKEN_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE_OPTIONS,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  getClientIp,
} from "@/lib/with-auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // 5 registrations per minute per IP — prevent spam account creation
  const throttled = await rateLimit(req, { prefix: "auth:register", windowSec: 60, max: 5 });
  if (throttled) return throttled;

  try {
    const body = await req.json();
    const parsed = RegisterDto.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map((i) => i.message).join(", "));
    }

    // Public registration is always CUSTOMER — never allow self-promoting to ADMIN/STAFF
    parsed.data.role = UserRole.CUSTOMER;

    const ds = await getDataSource();
    const service = new AuthService(ds);
    const result = await service.register(parsed.data, getClientIp(req));

    const response = created(result);
    response.cookies.set(ACCESS_TOKEN_COOKIE, result.tokens.accessToken, {
      ...TOKEN_COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60,
    });
    response.cookies.set(REFRESH_TOKEN_COOKIE, result.tokens.refreshToken, {
      ...REFRESH_TOKEN_COOKIE_OPTIONS,
      maxAge: 30 * 24 * 60 * 60,
    });
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "Email already registered") return badRequest(message);
    console.error("[auth:register]", err);
    return serverError("Registration failed");
  }
}
