import { z } from "zod";
import { getDataSource } from "@/lib/db";
import { UserService } from "@/modules/users/services/user.service";
import { User } from "@/modules/users/entities/user.entity";
import { withAuth, requireRole, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { UserRole } from "@/types";

const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().max(100).optional(),
  role: z.nativeEnum(UserRole).optional(),
});

export const GET = withAuth(async (req: AuthedRequest) => {
  const deny = requireRole(req.user, UserRole.ADMIN);
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const parsed = ListQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return badRequest(parsed.error.issues.map((i) => i.message).join(", "));

  try {
    const ds = await getDataSource();
    const service = new UserService(ds.getRepository(User));
    const result = await service.list(
      parsed.data.page,
      parsed.data.pageSize,
      parsed.data.search,
      parsed.data.role,
    );
    // Strip passwords from response
    return ok({
      ...result,
      data: result.data.map((u) => service.sanitize(u)),
    });
  } catch (err) {
    console.error("[users:GET]", err); return serverError("Failed to list users");
  }
});
