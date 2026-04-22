import { NextRequest } from "next/server";
import { z } from "zod";
import { getDataSource } from "@/lib/db";
import { AuditLog } from "@/modules/auth/entities/audit-log.entity";
import { withAuth, requireRole, AuthedRequest } from "@/lib/with-auth";
import { UserRole } from "@/types";
import { serverError, badRequest } from "@/lib/api-response";
import { NextResponse } from "next/server";

const QuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  action: z.string().max(100).optional(),
  userId: z.string().uuid().optional(),
  resourceType: z.string().max(100).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const GET = withAuth(async (req: AuthedRequest) => {
  // ADMIN only — audit logs are sensitive
  const deny = requireRole(req.user, UserRole.ADMIN);
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const { page, pageSize, action, userId, resourceType, from, to } = parsed.data;

  try {
    const ds = await getDataSource();
    const repo = ds.getRepository(AuditLog);

    const qb = repo
      .createQueryBuilder("al")
      .orderBy("al.createdAt", "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (action) qb.andWhere("al.action ILIKE :action", { action: `%${action}%` });
    if (userId) qb.andWhere("al.userId = :userId", { userId });
    if (resourceType) qb.andWhere("al.resourceType = :resourceType", { resourceType });
    if (from) qb.andWhere("al.createdAt >= :from", { from: new Date(from) });
    if (to) qb.andWhere("al.createdAt <= :to", { to: new Date(to) });

    const [data, total] = await qb.getManyAndCount();

    return NextResponse.json({
      success: true,
      data: {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "Failed to load audit logs");
  }
});
