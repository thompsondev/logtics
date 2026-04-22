import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db";
import { AuthService } from "@/modules/auth/auth.service";
import { ok, unauthorized, serverError } from "@/lib/api-response";
import {
  TOKEN_COOKIE_OPTIONS,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/with-auth";

export async function POST(req: NextRequest) {
  try {
    const refreshToken =
      req.cookies.get(REFRESH_TOKEN_COOKIE)?.value ??
      (await req.json().catch(() => ({}))).refreshToken;

    if (!refreshToken) return unauthorized("No refresh token");

    const ds = await getDataSource();
    const service = new AuthService(ds);
    const tokens = await service.refresh(refreshToken);

    const response = ok(tokens);
    response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      ...TOKEN_COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60,
    });
    response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      ...TOKEN_COOKIE_OPTIONS,
      maxAge: 30 * 24 * 60 * 60,
    });
    return response;
  } catch {
    return unauthorized("Invalid or expired refresh token");
  }
}
