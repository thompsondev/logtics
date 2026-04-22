import { z } from "zod";
import { getDataSource } from "@/lib/db";
import { UserService } from "@/modules/users/services/user.service";
import { User } from "@/modules/users/entities/user.entity";
import { withAuth, requireRole, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, forbidden, serverError } from "@/lib/api-response";
import { UserRole } from "@/types";

const UpdateRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
});

type Params = { id: string };

export const PATCH = withAuth<unknown, Params>(async (req: AuthedRequest, ctx) => {
  const deny = requireRole(req.user, UserRole.ADMIN);
  if (deny) return deny;

  const { id } = await ctx.params;

  // Prevent self-role-change
  if (id === req.user.id) return forbidden("You cannot change your own role");

  try {
    const body = await req.json();
    const parsed = UpdateRoleSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues.map((i) => i.message).join(", "));

    const ds = await getDataSource();
    const service = new UserService(ds.getRepository(User));
    const user = await service.updateRole(id, parsed.data.role);
    return ok(service.sanitize(user));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update user";
    if (msg.includes("not found") || msg.includes("No entity")) return notFound("User not found");
    return serverError(msg);
  }
});

export const DELETE = withAuth<unknown, Params>(async (req: AuthedRequest, ctx) => {
  const deny = requireRole(req.user, UserRole.ADMIN);
  if (deny) return deny;

  const { id } = await ctx.params;

  if (id === req.user.id) return forbidden("You cannot deactivate your own account");

  try {
    const ds = await getDataSource();
    const service = new UserService(ds.getRepository(User));
    const user = await service.findById(id);
    if (!user) return notFound("User not found");
    await service.deactivate(id);
    return ok({ deactivated: true });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "Failed to deactivate user");
  }
});
