import { withAuth, requireRole, AuthedRequest } from "@/lib/with-auth";
import { ok, serverError } from "@/lib/api-response";
import { getQueueStats } from "@/lib/queue";
import { UserRole } from "@/types";

export const GET = withAuth(async (req: AuthedRequest) => {
  const guard = requireRole(req.user, UserRole.ADMIN);
  if (guard) return guard;

  try {
    const stats = await getQueueStats();
    return ok(stats);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "Failed to get queue stats");
  }
});
