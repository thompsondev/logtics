import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db";
import { TrackingService } from "@/modules/tracking/services/tracking.service";
import { rateLimit } from "@/lib/rate-limit";
import { ok, notFound, serverError } from "@/lib/api-response";

type Params = { trackingNumber: string };

export async function GET(req: NextRequest, ctx: { params: Promise<Params> }) {
  // Rate limit: 30 requests per minute per IP — this endpoint is fully public
  const throttled = await rateLimit(req, { prefix: "tracking", windowSec: 60, max: 30 });
  if (throttled) return throttled;

  try {
    const { trackingNumber } = await ctx.params;
    const ds = await getDataSource();
    const service = new TrackingService(ds);
    const result = await service.getByTrackingNumber(trackingNumber.toUpperCase());
    if (!result) return notFound("Shipment not found for tracking number: " + trackingNumber);
    return ok(result);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "Tracking lookup failed");
  }
}
