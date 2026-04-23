import { z } from "zod";
import { getDataSource } from "@/lib/db";
import { AuthService } from "@/modules/auth/auth.service";
import { User } from "@/modules/users/entities/user.entity";
import { UserService } from "@/modules/users/services/user.service";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, unauthorized, badRequest, serverError } from "@/lib/api-response";

const UpdateMeDto = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName:  z.string().min(1).max(100).optional(),
  phone:     z.string().max(20).nullable().optional(),
});

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
    console.error("[auth:me:GET]", err);
    return serverError("Failed to retrieve user");
  }
});

export const PATCH = withAuth(async (req: AuthedRequest) => {
  try {
    const body = await req.json();
    const parsed = UpdateMeDto.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map((i) => i.message).join(", "));
    }

    const ds = await getDataSource();
    const userService = new UserService(ds.getRepository(User));

    await ds.getRepository(User).update(req.user.id, {
      ...(parsed.data.firstName !== undefined && { firstName: parsed.data.firstName }),
      ...(parsed.data.lastName  !== undefined && { lastName:  parsed.data.lastName  }),
      ...(parsed.data.phone     !== undefined && { phone:     parsed.data.phone     }),
    });

    const updated = await userService.findById(req.user.id);
    if (!updated) return unauthorized("User not found");

    return ok(userService.sanitize(updated));
  } catch (err) {
    console.error("[auth:me:PATCH]", err);
    return serverError("Failed to update profile");
  }
});
