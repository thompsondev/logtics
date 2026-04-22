import { DataSource, Repository, SelectQueryBuilder } from "typeorm";
import { Shipment } from "@/modules/shipments/entities/shipment.entity";
import { Address } from "@/modules/shipments/entities/address.entity";
import { TrackingEvent } from "@/modules/tracking/entities/tracking-event.entity";
import { AuditLog } from "@/modules/auth/entities/audit-log.entity";
import { Driver } from "@/modules/fleet/entities/driver.entity";
import { Vehicle } from "@/modules/fleet/entities/vehicle.entity";
import {
  CreateShipmentInput,
  UpdateShipmentInput,
  UpdateStatusInput,
  ListShipmentsInput,
} from "@/modules/shipments/dtos/shipment.dto";
import { ShipmentStatus, ShippingMethod, UserRole } from "@/types";
import { AUDIT_ACTIONS } from "@/config/constants";
import { AuditMetadata } from "@/modules/auth/entities/audit-log.entity";
import { notificationQueue, trackingEventQueue } from "@/lib/queue";
import { cacheDel } from "@/lib/redis";
import { broadcastTrackingUpdate } from "@/lib/realtime";
import { logger } from "@/lib/logger";

// Status transition rules — a status can only move to one of these next states
const ALLOWED_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  [ShipmentStatus.CREATED]: [ShipmentStatus.PICKED_UP, ShipmentStatus.RETURNED],
  [ShipmentStatus.PICKED_UP]: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.RETURNED],
  [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.ARRIVED_AT_HUB, ShipmentStatus.RETURNED],
  [ShipmentStatus.ARRIVED_AT_HUB]: [ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.RETURNED],
  [ShipmentStatus.OUT_FOR_DELIVERY]: [
    ShipmentStatus.DELIVERED,
    ShipmentStatus.FAILED_DELIVERY,
    ShipmentStatus.RETURNED,
  ],
  [ShipmentStatus.DELIVERED]: [],
  [ShipmentStatus.FAILED_DELIVERY]: [ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.RETURNED],
  [ShipmentStatus.RETURNED]: [],
};

// Base prices (USD) per kg by shipping method
const METHOD_RATE: Record<ShippingMethod, number> = {
  [ShippingMethod.ECONOMY]: 2.5,
  [ShippingMethod.STANDARD]: 4.0,
  [ShippingMethod.EXPRESS]: 7.5,
  [ShippingMethod.OVERNIGHT]: 15.0,
};

// Columns that callers may sort by — guards against SQL column-injection
const SORT_ALLOWLIST = new Set([
  "createdAt",
  "updatedAt",
  "status",
  "shippingMethod",
  "price",
  "weightKg",
  "trackingNumber",
  "estimatedDelivery",
  "actualDelivery",
]);

export class ShipmentService {
  private readonly shipmentRepo: Repository<Shipment>;
  private readonly addressRepo: Repository<Address>;
  private readonly trackingRepo: Repository<TrackingEvent>;
  private readonly auditRepo: Repository<AuditLog>;
  private readonly driverRepo: Repository<Driver>;
  private readonly vehicleRepo: Repository<Vehicle>;

  constructor(private readonly ds: DataSource) {
    this.shipmentRepo = ds.getRepository(Shipment);
    this.addressRepo = ds.getRepository(Address);
    this.trackingRepo = ds.getRepository(TrackingEvent);
    this.auditRepo = ds.getRepository(AuditLog);
    this.driverRepo = ds.getRepository(Driver);
    this.vehicleRepo = ds.getRepository(Vehicle);
  }

  // ─── Create ─────────────────────────────────────────────────────────────

  async create(input: CreateShipmentInput, senderId: string): Promise<Shipment> {
    const [origin, destination] = await Promise.all([
      this.addressRepo.save(this.addressRepo.create(input.origin)),
      this.addressRepo.save(this.addressRepo.create(input.destination)),
    ]);

    const price = this.calculatePrice(input.weightKg, input.shippingMethod);

    const shipment = this.shipmentRepo.create({
      senderId,
      receiver: input.receiver,
      originId: origin.id,
      destinationId: destination.id,
      weightKg: input.weightKg,
      dimensions: input.dimensions ?? null,
      shippingMethod: input.shippingMethod,
      price,
      currency: input.currency,
      estimatedDelivery: input.estimatedDelivery ? new Date(input.estimatedDelivery) : null,
      notes: input.notes ?? null,
      isFragile: input.isFragile,
      requiresSignature: input.requiresSignature,
    });

    const saved = await this.shipmentRepo.save(shipment);

    await this.logEvent(saved.id, ShipmentStatus.CREATED, senderId, {
      description: "Shipment created and awaiting pickup",
      location: origin.city + ", " + origin.country,
    });

    await this.dispatchJobs(saved, ShipmentStatus.CREATED);
    await cacheDel(`tracking:${saved.trackingNumber}`);
    await this.audit(senderId, AUDIT_ACTIONS.SHIPMENT_CREATED, "Shipment", saved.id);

    return this.getById(saved.id) as Promise<Shipment>;
  }

  // ─── List ────────────────────────────────────────────────────────────────

  async list(query: ListShipmentsInput, requestingUser: { id: string; role: UserRole }) {
    const { page, pageSize, status, shippingMethod, search, sortBy, sortOrder, from, to } = query;

    const qb: SelectQueryBuilder<Shipment> = this.shipmentRepo
      .createQueryBuilder("s")
      .leftJoinAndSelect("s.origin", "origin")
      .leftJoinAndSelect("s.destination", "destination")
      .leftJoinAndSelect("s.sender", "sender");

    // Customers only see their own shipments
    if (requestingUser.role === UserRole.CUSTOMER) {
      qb.where("s.senderId = :senderId", { senderId: requestingUser.id });
    } else if (query.senderId) {
      qb.where("s.senderId = :senderId", { senderId: query.senderId });
    }

    if (status) qb.andWhere("s.status = :status", { status });
    if (shippingMethod) qb.andWhere("s.shippingMethod = :shippingMethod", { shippingMethod });
    if (from) qb.andWhere("s.createdAt >= :from", { from });
    if (to) qb.andWhere("s.createdAt <= :to", { to });

    if (search) {
      qb.andWhere(
        "(s.trackingNumber ILIKE :q OR s.receiver->>'name' ILIKE :q OR s.receiver->>'email' ILIKE :q)",
        { q: `%${search}%` },
      );
    }

    const safeSortBy = SORT_ALLOWLIST.has(sortBy) ? sortBy : "createdAt";
    qb.orderBy(`s.${safeSortBy}`, sortOrder)
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ─── Get one ─────────────────────────────────────────────────────────────

  async getById(id: string): Promise<Shipment | null> {
    return this.shipmentRepo
      .createQueryBuilder("s")
      .leftJoinAndSelect("s.origin", "origin")
      .leftJoinAndSelect("s.destination", "destination")
      .leftJoinAndSelect("s.sender", "sender")
      .leftJoinAndSelect("s.trackingEvents", "events")
      .where("s.id = :id", { id })
      .orderBy("events.createdAt", "ASC")
      .getOne();
  }

  async getByTrackingNumber(trackingNumber: string): Promise<Shipment | null> {
    return this.shipmentRepo
      .createQueryBuilder("s")
      .leftJoinAndSelect("s.origin", "origin")
      .leftJoinAndSelect("s.destination", "destination")
      .leftJoinAndSelect("s.trackingEvents", "events")
      .where("s.trackingNumber = :trackingNumber", { trackingNumber })
      .orderBy("events.createdAt", "ASC")
      .getOne();
  }

  // ─── Update fields ────────────────────────────────────────────────────────

  async update(id: string, input: UpdateShipmentInput, userId: string): Promise<Shipment> {
    const shipment = await this.getById(id);
    if (!shipment) throw new Error("Shipment not found");

    // Validate driverId and vehicleId against their respective tables
    // before persisting — prevents dangling FK references and IDOR abuse.
    if (input.driverId !== undefined && input.driverId !== null) {
      const driver = await this.driverRepo.findOne({ where: { id: input.driverId } });
      if (!driver) throw new Error("Driver not found");
    }
    if (input.vehicleId !== undefined && input.vehicleId !== null) {
      const vehicle = await this.vehicleRepo.findOne({ where: { id: input.vehicleId } });
      if (!vehicle) throw new Error("Vehicle not found");
    }

    await this.shipmentRepo.update(id, {
      ...(input.receiver && { receiver: { ...shipment.receiver, ...input.receiver } }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.estimatedDelivery && { estimatedDelivery: new Date(input.estimatedDelivery) }),
      ...(input.isFragile !== undefined && { isFragile: input.isFragile }),
      ...(input.requiresSignature !== undefined && {
        requiresSignature: input.requiresSignature,
      }),
      ...(input.driverId !== undefined && { driverId: input.driverId }),
      ...(input.vehicleId !== undefined && { vehicleId: input.vehicleId }),
    });

    await this.audit(userId, AUDIT_ACTIONS.SHIPMENT_UPDATED, "Shipment", id);
    return this.getById(id) as Promise<Shipment>;
  }

  // ─── Status transition ────────────────────────────────────────────────────

  async updateStatus(
    id: string,
    input: UpdateStatusInput,
    updatedById: string,
  ): Promise<Shipment> {
    const shipment = await this.getById(id);
    if (!shipment) throw new Error("Shipment not found");

    const allowed = ALLOWED_TRANSITIONS[shipment.status];
    if (!allowed.includes(input.status)) {
      throw new Error(
        `Cannot transition from ${shipment.status} to ${input.status}. Allowed: ${allowed.join(", ") || "none"}`,
      );
    }

    const updates: Partial<Shipment> = { status: input.status };
    if (input.status === ShipmentStatus.DELIVERED) {
      updates.actualDelivery = new Date();
    }

    await this.shipmentRepo.update(id, updates);

    await this.logEvent(id, input.status, updatedById, {
      description:
        input.description ?? this.defaultDescription(input.status),
      location: input.location,
      latitude: input.latitude,
      longitude: input.longitude,
    });

    await this.dispatchJobs({ ...shipment, ...updates } as Shipment, input.status);
    await cacheDel(`tracking:${shipment.trackingNumber}`);
    await this.audit(updatedById, AUDIT_ACTIONS.SHIPMENT_STATUS_CHANGED, "Shipment", id, {
      from: shipment.status,
      to: input.status,
    });

    return this.getById(id) as Promise<Shipment>;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  calculatePrice(weightKg: number, method: ShippingMethod): number {
    const base = 5.0;
    const rate = METHOD_RATE[method];
    return Math.round((base + weightKg * rate) * 100) / 100;
  }

  private async logEvent(
    shipmentId: string,
    status: ShipmentStatus,
    createdById: string | null,
    opts: { description: string; location?: string; latitude?: number; longitude?: number },
  ) {
    const event = this.trackingRepo.create({
      shipmentId,
      status,
      description: opts.description,
      location: opts.location ?? null,
      latitude: opts.latitude ?? null,
      longitude: opts.longitude ?? null,
      createdById,
    });
    await this.trackingRepo.save(event);
  }

  private async dispatchJobs(shipment: Shipment, status: ShipmentStatus) {
    try {
      await trackingEventQueue.add("status-changed", {
        shipmentId: shipment.id,
        trackingNumber: shipment.trackingNumber,
        status,
      });

      await notificationQueue.add("shipment-status-email", {
        type: "email",
        recipient: shipment.receiver?.email ?? "",
        subject: `Your shipment ${shipment.trackingNumber} — ${status}`,
        template: "shipment-status",
        payload: { shipment, status },
      });

      // Realtime broadcast — non-blocking, best-effort
      await broadcastTrackingUpdate(shipment.trackingNumber, {
        status,
        shipmentId: shipment.id,
        trackingNumber: shipment.trackingNumber,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      // Queue / realtime failures are non-fatal — log but don't break the request
      logger.error("Failed to dispatch queue jobs", "ShipmentService", err);
    }
  }

  private async audit(
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata?: AuditMetadata,
  ) {
    const log = this.auditRepo.create({ userId, action, resourceType, resourceId, metadata: metadata ?? null });
    await this.auditRepo.save(log).catch(() => null);
  }

  private defaultDescription(status: ShipmentStatus): string {
    const MAP: Record<ShipmentStatus, string> = {
      [ShipmentStatus.CREATED]: "Shipment created",
      [ShipmentStatus.PICKED_UP]: "Package picked up from sender",
      [ShipmentStatus.IN_TRANSIT]: "Package is in transit",
      [ShipmentStatus.ARRIVED_AT_HUB]: "Package arrived at distribution hub",
      [ShipmentStatus.OUT_FOR_DELIVERY]: "Package is out for delivery",
      [ShipmentStatus.DELIVERED]: "Package delivered successfully",
      [ShipmentStatus.FAILED_DELIVERY]: "Delivery attempt failed",
      [ShipmentStatus.RETURNED]: "Package returned to sender",
    };
    return MAP[status];
  }
}
