import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "@/modules/users/entities/user.entity";
import { Vehicle } from "./vehicle.entity";

@Entity("drivers")
@Index(["userId"], { unique: true })
@Index(["licenseNumber"], { unique: true })
export class Driver {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  userId: string;

  @OneToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ unique: true, length: 50 })
  licenseNumber: string;

  @Column({ length: 20, nullable: true })
  phone: string | null;

  @Column({ default: true })
  isAvailable: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true, length: 36 })
  currentVehicleId: string | null;

  @OneToOne(() => Vehicle, { nullable: true })
  @JoinColumn({ name: "currentVehicleId" })
  currentVehicle: Vehicle | null;

  // Running stats — updated by background jobs
  @Column({ type: "int", default: 0 })
  totalDeliveries: number;

  @Column({ type: "int", default: 0 })
  successfulDeliveries: number;

  @Column({ type: "decimal", precision: 4, scale: 2, default: 0 })
  rating: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
