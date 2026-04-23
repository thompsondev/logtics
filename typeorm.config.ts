// TypeORM CLI config — used only by migration commands (ts-node, not tsx)
import "reflect-metadata";
import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import * as fs from "fs";

// In production env vars come from the platform (Railway etc.).
// Locally we load from .env.
dotenv.config();

import { User } from "./src/modules/users/entities/user.entity";
import { Address } from "./src/modules/shipments/entities/address.entity";
import { Shipment } from "./src/modules/shipments/entities/shipment.entity";
import { TrackingEvent } from "./src/modules/tracking/entities/tracking-event.entity";
import { Driver } from "./src/modules/fleet/entities/driver.entity";
import { Vehicle } from "./src/modules/fleet/entities/vehicle.entity";
import { AuditLog } from "./src/modules/auth/entities/audit-log.entity";

const dbUrl = process.env.DATABASE_URL ?? "";

if (!dbUrl) {
  console.error("\n❌  DATABASE_URL is not set in your .env\n");
  process.exit(1);
}

if (dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1")) {
  console.warn(
    "\n⚠️   DATABASE_URL points to localhost — make sure this is intentional.\n" +
    "    If you meant to use Neon, paste your connection string from https://console.neon.tech\n",
  );
}

// Detect SSL requirement from the URL (Neon, Supabase, etc.)
function requiresSsl(url: string): boolean {
  try {
    const { hostname, searchParams } = new URL(url);
    return (
      searchParams.get("sslmode") === "require" ||
      hostname.endsWith(".neon.tech") ||
      hostname.endsWith(".supabase.co")
    );
  } catch {
    return false;
  }
}

export default new DataSource({
  type: "postgres",
  // Use url-only connection — avoids conflicts when individual fields are empty
  url: dbUrl,
  synchronize: false,
  logging: true,
  entities: [User, Address, Shipment, TrackingEvent, Driver, Vehicle, AuditLog],
  // ts-node executes .ts directly, so *.ts glob is correct here
  migrations: ["db/migrations/*.ts"],
  ssl: requiresSsl(dbUrl) ? { rejectUnauthorized: false } : false,
});
