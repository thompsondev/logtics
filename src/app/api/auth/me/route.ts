import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db";
import { AuthService } from "@/modules/auth/auth.service";
import { ok, unauthorized, serverError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) return unauthorized();

    const ds = await getDataSource();
    const service = new AuthService(ds);
    const user = await service.me(userId);
    return ok(user);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    if (message === "User not found") return unauthorized(message);
    return serverError(message);
  }
}
