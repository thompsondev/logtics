import { DataSource, Repository } from "typeorm";
import { TrackingEvent } from "@/modules/tracking/entities/tracking-event.entity";
import { Shipment } from "@/modules/shipments/entities/shipment.entity";
import { cacheGet, cacheSet, cacheDel } from "@/lib/redis";
import { CACHE_TTL } from "@/config/constants";
import { ShipmentStatus } from "@/types";

export interface TimelineEntry {
  id: string;
  status: ShipmentStatus;
  label: string;
  description: string;
  location: string | null;
  timestamp: Date;
  isLatest: boolean;
  coordinates: { lat: number; lng: number } | null;
}

export interface TrackingResult {
  trackingNumber: string;
  status: ShipmentStatus;
  shippingMethod: string;
  origin: {
    city: string;
    country: string;
    formatted: string;
  };
  destination: {
    city: string;
    country: string;
    formatted: string;
  };
  receiver: {
    name: string;
  };
  estimatedDelivery: Date | null;
  actualDelivery: Date | null;
  weightKg: number;
  isFragile: boolean;
  requiresSignature: boolean;
  timeline: TimelineEntry[];
  lastUpdated: Date;
}

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  [ShipmentStatus.CREATED]: "Order Created",
  [ShipmentStatus.PICKED_UP]: "Picked Up",
  [ShipmentStatus.IN_TRANSIT]: "In Transit",
  [ShipmentStatus.ARRIVED_AT_HUB]: "Arrived at Hub",
  [ShipmentStatus.OUT_FOR_DELIVERY]: "Out for Delivery",
  [ShipmentStatus.DELIVERED]: "Delivered",
  [ShipmentStatus.FAILED_DELIVERY]: "Delivery Failed",
  [ShipmentStatus.RETURNED]: "Returned",
};

// Ordered status progression for the visual stepper
export const STATUS_STEPS: ShipmentStatus[] = [
  ShipmentStatus.CREATED,
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.ARRIVED_AT_HUB,
  ShipmentStatus.OUT_FOR_DELIVERY,
  ShipmentStatus.DELIVERED,
];

export class TrackingService {
  private readonly eventRepo: Repository<TrackingEvent>;
  private readonly shipmentRepo: Repository<Shipment>;

  constructor(private readonly ds: DataSource) {
    this.eventRepo = ds.getRepository(TrackingEvent);
    this.shipmentRepo = ds.getRepository(Shipment);
  }

  // ─── Public tracking lookup (cached) ─────────────────────────────────────

  async getByTrackingNumber(trackingNumber: string): Promise<TrackingResult | null> {
    const cacheKey = `tracking:${trackingNumber}`;

    const cached = await cacheGet<TrackingResult>(cacheKey);
    if (cached) return cached;

    const shipment = await this.shipmentRepo
      .createQueryBuilder("s")
      .leftJoinAndSelect("s.origin", "origin")
      .leftJoinAndSelect("s.destination", "destination")
      .leftJoinAndSelect("s.trackingEvents", "events")
      .where("s.trackingNumber = :trackingNumber", { trackingNumber })
      .orderBy("events.createdAt", "ASC")
      .getOne();

    if (!shipment) return null;

    const result = this.format(shipment);
    await cacheSet(cacheKey, result, CACHE_TTL.TRACKING);
    return result;
  }

  // ─── Auth-protected event list ────────────────────────────────────────────

  async getEvents(
    shipmentId: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: TrackingEvent[]; total: number }> {
    const [data, total] = await this.eventRepo.findAndCount({
      where: { shipmentId },
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total };
  }

  // ─── Cache invalidation ───────────────────────────────────────────────────

  async invalidateCache(trackingNumber: string): Promise<void> {
    await cacheDel(`tracking:${trackingNumber}`);
  }

  // ─── Format shipment into tracking result ─────────────────────────────────

  private format(shipment: Shipment): TrackingResult {
    const events = (shipment.trackingEvents ?? []) as TrackingEvent[];
    const latestEvent = events[events.length - 1];

    const timeline: TimelineEntry[] = events.map((ev, i) => ({
      id: ev.id,
      status: ev.status,
      label: STATUS_LABELS[ev.status] ?? ev.status,
      description: ev.description,
      location: ev.location,
      timestamp: ev.createdAt,
      isLatest: i === events.length - 1,
      coordinates:
        ev.latitude != null && ev.longitude != null
          ? { lat: Number(ev.latitude), lng: Number(ev.longitude) }
          : null,
    }));

    return {
      trackingNumber: shipment.trackingNumber,
      status: shipment.status,
      shippingMethod: shipment.shippingMethod,
      origin: {
        city: shipment.origin.city,
        country: shipment.origin.country,
        formatted: shipment.origin.formatted,
      },
      destination: {
        city: shipment.destination.city,
        country: shipment.destination.country,
        formatted: shipment.destination.formatted,
      },
      receiver: {
        name: shipment.receiver.name,
      },
      estimatedDelivery: shipment.estimatedDelivery,
      actualDelivery: shipment.actualDelivery,
      weightKg: Number(shipment.weightKg),
      isFragile: shipment.isFragile,
      requiresSignature: shipment.requiresSignature,
      timeline,
      lastUpdated: latestEvent?.createdAt ?? shipment.updatedAt,
    };
  }
}
