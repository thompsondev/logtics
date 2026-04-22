import { z } from "zod";
import { getDataSource } from "@/lib/db";
import { FleetService } from "@/modules/fleet";
import { withAuth, requireRole, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, notFound, serverError } from "@/lib/api-response";
import { UserRole, VehicleStatus } from "@/types";

const UpdateVehicleSchema = z.object({
  status: z.nativeEnum(VehicleStatus).optional(),
  model: z.string().max(100).optional(),
  capacityKg: z.number().positive().max(50000).optional(),
  notes: z.string().max(500).nullable().optional(),
  currentDriverId: z.string().uuid().nullable().optional(),
});

type Params = { id: string };

export const PATCH = withAuth<unknown, Params>(async (req: AuthedRequest, ctx) => {
  const deny = requireRole(req.user, UserRole.ADMIN, UserRole.STAFF);
  if (deny) return deny;

  const { id } = await ctx.params;

  try {
    const body = await req.json();
    const parsed = UpdateVehicleSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues.map((i) => i.message).join(", "));

    const ds = await getDataSource();
    const service = new FleetService(ds);
    const vehicle = await service.updateVehicle(id, parsed.data);
    return ok(vehicle);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("not found") || msg.includes("No entity")) return notFound("Vehicle not found");
    console.error("[fleet:PATCH]", err);
    return serverError("Failed to update vehicle");
  }
});

export const DELETE = withAuth<unknown, Params>(async (req: AuthedRequest, ctx) => {
  const deny = requireRole(req.user, UserRole.ADMIN);
  if (deny) return deny;

  const { id } = await ctx.params;

  try {
    const ds = await getDataSource();
    const service = new FleetService(ds);
    const vehicle = await service.getVehicle(id);
    if (!vehicle) return notFound("Vehicle not found");
    await service.deleteVehicle(id);
    return ok({ deleted: true });
  } catch (err) {
    console.error("[fleet:DELETE]", err);
    return serverError("Failed to delete vehicle");
  }
});
