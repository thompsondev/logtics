import { getDataSource } from "@/lib/db";
import { ShipmentService } from "@/modules/shipments/services/shipment.service";
import { UpdateStatusDto } from "@/modules/shipments/dtos/shipment.dto";
import { withAuth, requireRole, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, serverError } from "@/lib/api-response";
import { UserRole } from "@/types";

type IdParams = { id: string };

export const PATCH = withAuth<unknown, IdParams>(async (req: AuthedRequest, ctx) => {
  try {
    const guard = requireRole(req.user, UserRole.ADMIN, UserRole.STAFF);
    if (guard) return guard;

    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = UpdateStatusDto.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map((i) => i.message).join(", "));
    }

    const ds = await getDataSource();
    const service = new ShipmentService(ds);
    const shipment = await service.updateStatus(id, parsed.data, req.user.id);
    return ok(shipment);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update status";
    if (msg === "Shipment not found") return notFound(msg);
    if (msg.startsWith("Cannot transition")) return badRequest(msg);
    return serverError(msg);
  }
});
