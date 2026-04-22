import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db";
import { ShipmentService } from "@/modules/shipments/services/shipment.service";
import { CreateShipmentDto, ListShipmentsQuery } from "@/modules/shipments/dtos/shipment.dto";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { created, paginated, badRequest, serverError } from "@/lib/api-response";
import { User } from "@/modules/users/entities/user.entity";
import { UserRole } from "@/types";
import { rateLimit } from "@/lib/rate-limit";

export const GET = withAuth(async (req: AuthedRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const raw = Object.fromEntries(searchParams.entries());
    const parsed = ListShipmentsQuery.safeParse(raw);
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map((i) => i.message).join(", "));
    }

    const ds = await getDataSource();
    const service = new ShipmentService(ds);
    const result = await service.list(parsed.data, req.user);
    return paginated(result);
  } catch (err) {
    console.error("[shipments:GET]", err);
    return serverError("Failed to list shipments");
  }
});

export const POST = withAuth(async (req: AuthedRequest) => {
  // 20 shipment creations per minute per IP
  const throttled = await rateLimit(req, { prefix: "shipments:create", windowSec: 60, max: 20 });
  if (throttled) return throttled;

  try {
    const body = await req.json();
    const parsed = CreateShipmentDto.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map((i) => i.message).join(", "));
    }

    // CUSTOMER can only create shipments for themselves
    const senderId =
      req.user.role === UserRole.CUSTOMER ? req.user.id : (body.senderId ?? req.user.id);

    const ds = await getDataSource();

    // Validate that the senderId points to a real, active user account
    // (guards against IDOR — admin supplying an arbitrary UUID as senderId)
    if (senderId !== req.user.id) {
      const userRepo = ds.getRepository(User);
      const senderExists = await userRepo.existsBy({ id: senderId, isActive: true });
      if (!senderExists) {
        return badRequest("Sender user not found");
      }
    }

    const service = new ShipmentService(ds);
    const shipment = await service.create(parsed.data, senderId);
    return created(shipment);
  } catch (err) {
    // Don't expose raw DB errors or stack traces
    const safe = err instanceof Error && err.message.length < 200 ? err.message : "Failed to create shipment";
    return serverError(safe);
  }
});
