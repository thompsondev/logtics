import { z } from "zod";
import { getDataSource } from "@/lib/db";
import { FleetService, VehicleType } from "@/modules/fleet";
import { withAuth, requireRole, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { UserRole, VehicleStatus } from "@/types";
import { NextResponse } from "next/server";

const CreateVehicleSchema = z.object({
  plateNumber: z.string().min(2).max(20).trim(),
  type: z.nativeEnum(VehicleType),
  model: z.string().max(100).optional(),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1).optional(),
  capacityKg: z.number().positive().max(50000),
  notes: z.string().max(500).optional(),
});

const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const GET = withAuth(async (req: AuthedRequest) => {
  const deny = requireRole(req.user, UserRole.ADMIN, UserRole.STAFF);
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const parsed = ListQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return badRequest(parsed.error.issues.map((i) => i.message).join(", "));

  try {
    const ds = await getDataSource();
    const service = new FleetService(ds);
    const [vehicles, summary] = await Promise.all([
      service.listVehicles(parsed.data.page, parsed.data.pageSize),
      service.fleetSummary(),
    ]);
    return ok({ ...vehicles, summary });
  } catch (err) {
    console.error("[fleet:GET]", err);
    return serverError("Failed to list fleet");
  }
});

export const POST = withAuth(async (req: AuthedRequest) => {
  const deny = requireRole(req.user, UserRole.ADMIN);
  if (deny) return deny;

  try {
    const body = await req.json();
    const parsed = CreateVehicleSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues.map((i) => i.message).join(", "));

    const ds = await getDataSource();
    const service = new FleetService(ds);
    const vehicle = await service.createVehicle(parsed.data);
    return NextResponse.json({ success: true, data: vehicle }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "Plate number already registered") return badRequest(msg);
    console.error("[fleet:POST]", err);
    return serverError("Failed to create vehicle");
  }
});
