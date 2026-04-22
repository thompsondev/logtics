import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/db";
import { AuthService } from "@/modules/auth/auth.service";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/with-auth";

export async function POST(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  // Best-effort server-side invalidation — never fail the logout UX
  if (accessToken) {
    try {
      const ds = await getDataSource();
      const service = new AuthService(ds);
      await service.logout(accessToken, refreshToken);
    } catch {
      // Non-critical; the cookies will be cleared regardless
    }
  }

  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  return response;
}
