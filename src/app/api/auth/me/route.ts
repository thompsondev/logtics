import { getDataSource } from "@/lib/db";
import { AuthService } from "@/modules/auth/auth.service";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, serverError } from "@/lib/api-response";

// withAuth re-verifies the JWT — no header-trust vulnerability
export const GET = withAuth(async (req: AuthedRequest) => {
  try {
    const ds = await getDataSource();
    const service = new AuthService(ds);
    const user = await service.me(req.user.id);
    return ok(user);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "User not found") return unauthorized(msg);
    console.error("[auth:me]", err);
    return serverError("Failed to retrieve user");
  }
});
