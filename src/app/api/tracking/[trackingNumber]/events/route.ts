import { getDataSource } from "@/lib/db";
import { TrackingService } from "@/modules/tracking/services/tracking.service";
import { ShipmentService } from "@/modules/shipments/services/shipment.service";
import { withAuth, requireRole, AuthedRequest } from "@/lib/with-auth";
import { ok, notFound, forbidden, serverError } from "@/lib/api-response";
import { UserRole } from "@/types";

type Params = { trackingNumber: string };

export const GET = withAuth<unknown, Params>(async (req: AuthedRequest, ctx) => {
  try {
    const { trackingNumber } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));

    const ds = await getDataSource();
    const shipmentService = new ShipmentService(ds);
    const shipment = await shipmentService.getByTrackingNumber(trackingNumber.toUpperCase());
    if (!shipment) return notFound("Shipment not found");

    // Customer can only view events for their own shipments
    if (req.user.role === UserRole.CUSTOMER && shipment.senderId !== req.user.id) {
      const guard = requireRole(req.user, UserRole.ADMIN, UserRole.STAFF);
      if (guard) return forbidden();
    }

    const trackingService = new TrackingService(ds);
    const result = await trackingService.getEvents(shipment.id, page, pageSize);
    return ok({ ...result, page, pageSize, totalPages: Math.ceil(result.total / pageSize) });
  } catch (err) {
    console.error("[tracking-events:GET]", err);
    return serverError("Failed to get events");
  }
});
