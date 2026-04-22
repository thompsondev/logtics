import { getDataSource } from "@/lib/db";
import { ShipmentService } from "@/modules/shipments/services/shipment.service";
import { UpdateShipmentDto } from "@/modules/shipments/dtos/shipment.dto";
import { withAuth, requireRole, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, forbidden, serverError } from "@/lib/api-response";
import { UserRole, ShipmentStatus } from "@/types";

type IdParams = { id: string };

export const GET = withAuth<unknown, IdParams>(async (req: AuthedRequest, ctx) => {
  try {
    const { id } = await ctx.params;
    const ds = await getDataSource();
    const service = new ShipmentService(ds);
    const shipment = await service.getById(id);
    if (!shipment) return notFound("Shipment not found");

    if (req.user.role === UserRole.CUSTOMER && shipment.senderId !== req.user.id) {
      return forbidden();
    }

    return ok(shipment);
  } catch (err) {
    console.error("[shipments:GET]", err);
    return serverError("Failed to get shipment");
  }
});

export const PATCH = withAuth<unknown, IdParams>(async (req: AuthedRequest, ctx) => {
  try {
    const guard = requireRole(req.user, UserRole.ADMIN, UserRole.STAFF);
    if (guard) return guard;

    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = UpdateShipmentDto.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map((i) => i.message).join(", "));
    }

    const ds = await getDataSource();
    const service = new ShipmentService(ds);
    const shipment = await service.update(id, parsed.data, req.user.id);
    return ok(shipment);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "Shipment not found") return notFound(msg);
    if (msg === "Driver not found" || msg === "Vehicle not found") return badRequest(msg);
    console.error("[shipments:PATCH]", err);
    return serverError("Failed to update shipment");
  }
});

export const DELETE = withAuth<unknown, IdParams>(async (req: AuthedRequest, ctx) => {
  try {
    const guard = requireRole(req.user, UserRole.ADMIN);
    if (guard) return guard;

    const { id } = await ctx.params;
    const ds = await getDataSource();
    const service = new ShipmentService(ds);
    const shipment = await service.getById(id);
    if (!shipment) return notFound("Shipment not found");

    const updated = await service.updateStatus(
      id,
      { status: ShipmentStatus.RETURNED, description: "Shipment cancelled by admin" },
      req.user.id,
    );
    return ok(updated);
  } catch (err) {
    console.error("[shipments:DELETE]", err);
    return serverError("Failed to cancel shipment");
  }
});
