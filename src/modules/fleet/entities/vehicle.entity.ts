import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { VehicleStatus } from "@/types";

export enum VehicleType {
  VAN = "VAN",
  TRUCK = "TRUCK",
  MOTORCYCLE = "MOTORCYCLE",
  CAR = "CAR",
  BICYCLE = "BICYCLE",
}

@Entity("vehicles")
@Index(["plateNumber"], { unique: true })
@Index(["status"])
export class Vehicle {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true, length: 20 })
  plateNumber: string;

  @Column({ type: "enum", enum: VehicleType, default: VehicleType.VAN })
  type: VehicleType;

  @Column({ type: "varchar", length: 100, nullable: true })
  model: string | null;

  @Column({ type: "int", nullable: true })
  year: number | null;

  // Max payload in kg
  @Column({ type: "decimal", precision: 8, scale: 2 })
  capacityKg: number;

  @Column({ type: "enum", enum: VehicleStatus, default: VehicleStatus.AVAILABLE })
  status: VehicleStatus;

  @Column({ type: "uuid", nullable: true })
  currentDriverId: string | null;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
