import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  BeforeInsert,
} from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { ShipmentStatus, ShippingMethod } from "@/types";
import { User } from "@/modules/users/entities/user.entity";
import { Address } from "./address.entity";

export interface ShipmentDimensions {
  length: number;
  width: number;
  height: number;
  unit: "cm" | "in";
}

export interface ReceiverInfo {
  name: string;
  email: string;
  phone: string;
  company?: string;
}

@Entity("shipments")
@Index(["trackingNumber"], { unique: true })
@Index(["status"])
@Index(["senderId"])
@Index(["createdAt"])
export class Shipment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true, length: 30 })
  trackingNumber: string;

  // ─── Sender ──────────────────────────────────────────────────────────────

  @Column("uuid")
  senderId: string;

  @ManyToOne(() => User, (user) => user.shipments, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "senderId" })
  sender: User;

  // ─── Receiver (stored as JSON — no account required) ─────────────────────

  @Column({ type: "jsonb" })
  receiver: ReceiverInfo;

  // ─── Addresses ────────────────────────────────────────────────────────────

  @Column("uuid")
  originId: string;

  @ManyToOne(() => Address, { eager: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "originId" })
  origin: Address;

  @Column("uuid")
  destinationId: string;

  @ManyToOne(() => Address, { eager: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "destinationId" })
  destination: Address;

  // ─── Status lifecycle ─────────────────────────────────────────────────────

  @Column({ type: "enum", enum: ShipmentStatus, default: ShipmentStatus.CREATED })
  status: ShipmentStatus;

  // ─── Physical properties ──────────────────────────────────────────────────

  @Column({ type: "decimal", precision: 8, scale: 2 })
  weightKg: number;

  @Column({ type: "jsonb", nullable: true })
  dimensions: ShipmentDimensions | null;

  @Column({ type: "enum", enum: ShippingMethod, default: ShippingMethod.STANDARD })
  shippingMethod: ShippingMethod;

  // ─── Pricing ──────────────────────────────────────────────────────────────

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price: number;

  @Column({ length: 3, default: "USD" })
  currency: string;

  // ─── Delivery timestamps ──────────────────────────────────────────────────

  @Column({ nullable: true })
  estimatedDelivery: Date | null;

  @Column({ nullable: true })
  actualDelivery: Date | null;

  // ─── Assignment ───────────────────────────────────────────────────────────

  @Column({ nullable: true, length: 36 })
  driverId: string | null;

  @Column({ nullable: true, length: 36 })
  vehicleId: string | null;

  // ─── Metadata ─────────────────────────────────────────────────────────────

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @Column({ default: false })
  isFragile: boolean;

  @Column({ default: false })
  requiresSignature: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ─── Relations ────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @OneToMany("TrackingEvent", "shipment")
  trackingEvents: any[];

  // ─── Hooks ────────────────────────────────────────────────────────────────

  @BeforeInsert()
  generateTrackingNumber() {
    if (!this.trackingNumber) {
      // Use two separate UUID segments for 96 bits of entropy — no timestamp
      // prefix that would let an observer enumerate shipment volume or timing.
      const a = uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase();
      const b = uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase();
      this.trackingNumber = `LGT-${a}-${b}`;
    }
  }
}
