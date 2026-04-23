import "reflect-metadata";
import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Inline entity imports (avoids tsconfig path alias issues in ts-node)
import { User } from "../../src/modules/users/entities/user.entity";
import { Address } from "../../src/modules/shipments/entities/address.entity";
import { Shipment } from "../../src/modules/shipments/entities/shipment.entity";
import { TrackingEvent } from "../../src/modules/tracking/entities/tracking-event.entity";
import { Driver } from "../../src/modules/fleet/entities/driver.entity";
import { Vehicle } from "../../src/modules/fleet/entities/vehicle.entity";
import { AuditLog } from "../../src/modules/auth/entities/audit-log.entity";
import { UserRole, ShipmentStatus, ShippingMethod, VehicleStatus } from "../../src/types";
import { VehicleType } from "../../src/modules/fleet/entities/vehicle.entity";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is not set in .env");

const requiresSsl = dbUrl.includes("neon.tech") ||
  dbUrl.includes("sslmode=require") ||
  dbUrl.includes("supabase.co");

const ds = new DataSource({
  type: "postgres",
  url: dbUrl,
  synchronize: false,
  ssl: requiresSsl ? { rejectUnauthorized: false } : false,
  entities: [User, Address, Shipment, TrackingEvent, Driver, Vehicle, AuditLog],
});

async function seed() {
  await ds.initialize();
  console.log("✔  Connected to database");

  const userRepo = ds.getRepository(User);
  const addressRepo = ds.getRepository(Address);
  const vehicleRepo = ds.getRepository(Vehicle);
  const driverRepo = ds.getRepository(Driver);
  const shipmentRepo = ds.getRepository(Shipment);
  const trackingRepo = ds.getRepository(TrackingEvent);

  // ─── Users ────────────────────────────────────────────────────────────────
  // Pass plaintext — the @BeforeInsert hook on User handles bcrypt hashing.

  const admin = userRepo.create({
    firstName: "Alex",
    lastName: "Admin",
    email: "admin@logtics.io",
    password: "Password123!",
    role: UserRole.ADMIN,
    phone: "+1-555-0100",
  });

  const staff = userRepo.create({
    firstName: "Sam",
    lastName: "Staff",
    email: "staff@logtics.io",
    password: "Password123!",
    role: UserRole.STAFF,
    phone: "+1-555-0101",
  });

  const customer = userRepo.create({
    firstName: "Chris",
    lastName: "Customer",
    email: "customer@logtics.io",
    password: "Password123!",
    role: UserRole.CUSTOMER,
    phone: "+1-555-0102",
  });

  const driverUser = userRepo.create({
    firstName: "Dan",
    lastName: "Driver",
    email: "driver@logtics.io",
    password: "Password123!",
    role: UserRole.STAFF,
    phone: "+1-555-0103",
  });

  // @BeforeInsert will hash each password before INSERT
  await userRepo.save([admin, staff, customer, driverUser]);
  console.log("✔  Users seeded");

  // ─── Addresses ────────────────────────────────────────────────────────────
  const originAddress = addressRepo.create({
    street: "123 Warehouse Blvd",
    city: "Chicago",
    state: "IL",
    country: "US",
    postalCode: "60601",
    latitude: 41.8781,
    longitude: -87.6298,
  });

  const destAddress = addressRepo.create({
    street: "456 Main Street",
    city: "New York",
    state: "NY",
    country: "US",
    postalCode: "10001",
    latitude: 40.7128,
    longitude: -74.006,
  });

  await addressRepo.save([originAddress, destAddress]);
  console.log("✔  Addresses seeded");

  // ─── Vehicle ──────────────────────────────────────────────────────────────
  const vehicle = vehicleRepo.create({
    plateNumber: "LGT-001",
    type: VehicleType.VAN,
    model: "Ford Transit 2022",
    year: 2022,
    capacityKg: 1000,
    status: VehicleStatus.AVAILABLE,
  });
  await vehicleRepo.save(vehicle);
  console.log("✔  Vehicle seeded");

  // ─── Driver ───────────────────────────────────────────────────────────────
  const driver = driverRepo.create({
    userId: driverUser.id,
    licenseNumber: "DL-IL-987654",
    phone: "+1-555-0103",
    isAvailable: true,
    currentVehicleId: vehicle.id,
  });
  await driverRepo.save(driver);

  vehicle.currentDriverId = driver.id;
  vehicle.status = VehicleStatus.IN_USE;
  await vehicleRepo.save(vehicle);
  console.log("✔  Driver seeded");

  // ─── Shipment ─────────────────────────────────────────────────────────────
  const shipment = shipmentRepo.create({
    senderId: customer.id,
    receiver: {
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+1-555-9999",
      company: "Acme Corp",
    },
    originId: originAddress.id,
    destinationId: destAddress.id,
    status: ShipmentStatus.IN_TRANSIT,
    weightKg: 2.5,
    dimensions: { length: 30, width: 20, height: 15, unit: "cm" },
    shippingMethod: ShippingMethod.EXPRESS,
    price: 49.99,
    currency: "USD",
    estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    driverId: driver.id,
    vehicleId: vehicle.id,
    isFragile: false,
    requiresSignature: true,
    notes: "Handle with care",
  });

  await shipmentRepo.save(shipment);
  console.log("✔  Shipment seeded:", shipment.trackingNumber);

  // ─── Tracking events ──────────────────────────────────────────────────────
  const events = [
    {
      status: ShipmentStatus.CREATED,
      description: "Shipment created and ready for pickup",
      location: "Chicago, IL",
      createdById: customer.id,
    },
    {
      status: ShipmentStatus.PICKED_UP,
      description: "Package picked up from sender",
      location: "Chicago, IL – Warehouse",
      createdById: staff.id,
    },
    {
      status: ShipmentStatus.IN_TRANSIT,
      description: "Package in transit to destination hub",
      location: "Gary, IN – Distribution Center",
      createdById: null,
    },
  ];

  const baseTime = new Date(Date.now() - 2 * 60 * 60 * 1000);
  for (let i = 0; i < events.length; i++) {
    const event = trackingRepo.create({
      shipmentId: shipment.id,
      ...events[i],
      createdAt: new Date(baseTime.getTime() + i * 30 * 60 * 1000),
    } as Partial<TrackingEvent>);
    await trackingRepo.save(event);
  }
  console.log("✔  Tracking events seeded");

  await ds.destroy();
  console.log("\n🚀  Seed complete!");
  console.log("\nDefault credentials (all use password: Password123!):");
  console.log("  Admin:    admin@logtics.io");
  console.log("  Staff:    staff@logtics.io");
  console.log("  Customer: customer@logtics.io");
  console.log("  Driver:   driver@logtics.io");
  console.log(`\nSample tracking number: ${shipment.trackingNumber}`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
