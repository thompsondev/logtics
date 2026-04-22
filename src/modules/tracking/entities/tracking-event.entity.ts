import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { ShipmentStatus } from "@/types";
import { Shipment } from "@/modules/shipments/entities/shipment.entity";

@Entity("tracking_events")
@Index(["shipmentId", "createdAt"])
@Index(["shipmentId"])
export class TrackingEvent {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  shipmentId: string;

  @ManyToOne(() => Shipment, (shipment) => shipment.trackingEvents, { onDelete: "CASCADE" })
  @JoinColumn({ name: "shipmentId" })
  shipment: Shipment;

  @Column({ type: "enum", enum: ShipmentStatus })
  status: ShipmentStatus;

  @Column({ length: 255, nullable: true })
  location: string | null;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  // Who triggered this event (null = system-generated)
  @Column({ nullable: true, length: 36 })
  createdById: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
