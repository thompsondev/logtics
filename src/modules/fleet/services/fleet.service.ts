import { DataSource, Repository } from "typeorm";
import { Vehicle, VehicleType } from "@/modules/fleet/entities/vehicle.entity";
import { Driver } from "@/modules/fleet/entities/driver.entity";
import { VehicleStatus } from "@/types";

export interface CreateVehicleInput {
  plateNumber: string;
  type: VehicleType;
  model?: string;
  year?: number;
  capacityKg: number;
  notes?: string;
}

export interface UpdateVehicleInput {
  status?: VehicleStatus;
  model?: string;
  capacityKg?: number;
  notes?: string | null;
  currentDriverId?: string | null;
}

export class FleetService {
  private readonly vehicleRepo: Repository<Vehicle>;
  private readonly driverRepo: Repository<Driver>;

  constructor(private readonly ds: DataSource) {
    this.vehicleRepo = ds.getRepository(Vehicle);
    this.driverRepo = ds.getRepository(Driver);
  }

  async listVehicles(page: number, pageSize: number) {
    const [data, total] = await this.vehicleRepo.findAndCount({
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getVehicle(id: string): Promise<Vehicle | null> {
    return this.vehicleRepo.findOne({ where: { id } });
  }

  async createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
    const existing = await this.vehicleRepo.findOne({
      where: { plateNumber: input.plateNumber.toUpperCase() },
    });
    if (existing) throw new Error("Plate number already registered");

    const vehicle = this.vehicleRepo.create({
      plateNumber: input.plateNumber.toUpperCase(),
      type: input.type,
      model: input.model ?? null,
      year: input.year ?? null,
      capacityKg: input.capacityKg,
      notes: input.notes ?? null,
      status: VehicleStatus.AVAILABLE,
    });
    return this.vehicleRepo.save(vehicle);
  }

  async updateVehicle(id: string, input: UpdateVehicleInput): Promise<Vehicle> {
    const vehicle = await this.vehicleRepo.findOneOrFail({ where: { id } });
    Object.assign(vehicle, {
      ...(input.status !== undefined && { status: input.status }),
      ...(input.model !== undefined && { model: input.model }),
      ...(input.capacityKg !== undefined && { capacityKg: input.capacityKg }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.currentDriverId !== undefined && { currentDriverId: input.currentDriverId }),
    });
    return this.vehicleRepo.save(vehicle);
  }

  async deleteVehicle(id: string): Promise<void> {
    await this.vehicleRepo.delete(id);
  }

  async listDrivers(page: number, pageSize: number) {
    const [data, total] = await this.driverRepo.findAndCount({
      relations: ["user", "currentVehicle"],
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async fleetSummary() {
    const [total, available, inUse, maintenance] = await Promise.all([
      this.vehicleRepo.count(),
      this.vehicleRepo.count({ where: { status: VehicleStatus.AVAILABLE } }),
      this.vehicleRepo.count({ where: { status: VehicleStatus.IN_USE } }),
      this.vehicleRepo.count({ where: { status: VehicleStatus.MAINTENANCE } }),
    ]);
    const totalDrivers = await this.driverRepo.count({ where: { isActive: true } });
    const availableDrivers = await this.driverRepo.count({
      where: { isActive: true, isAvailable: true },
    });
    return { total, available, inUse, maintenance, totalDrivers, availableDrivers };
  }
}
