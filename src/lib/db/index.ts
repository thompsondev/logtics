import "reflect-metadata";
import { DataSource } from "typeorm";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";

// ─── Entities ─────────────────────────────────────────────────────────────
import { User } from "@/modules/users/entities/user.entity";
import { Address } from "@/modules/shipments/entities/address.entity";
import { Shipment } from "@/modules/shipments/entities/shipment.entity";
import { TrackingEvent } from "@/modules/tracking/entities/tracking-event.entity";
import { Driver } from "@/modules/fleet/entities/driver.entity";
import { Vehicle } from "@/modules/fleet/entities/vehicle.entity";
import { AuditLog } from "@/modules/auth/entities/audit-log.entity";

export const entities = [User, Address, Shipment, TrackingEvent, Driver, Vehicle, AuditLog];

export const AppDataSource = new DataSource({
  type: "postgres",
  url: env.DATABASE_URL,
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  synchronize: false,
  logging: env.NODE_ENV === "development",
  entities,
  migrations: ["db/migrations/*.ts"],
  subscribers: [],
  ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export async function getDataSource(): Promise<DataSource> {
  // Guard works both in production and during Next.js dev hot-reloads:
  // AppDataSource.isInitialized is the authoritative flag on the singleton instance,
  // so we never attempt a double-initialize even when modules are re-evaluated.
  if (!AppDataSource.isInitialized) {
    try {
      await AppDataSource.initialize();
      logger.info("Database connected", "DB");
    } catch (err) {
      logger.error("Database connection failed", "DB", err);
      throw err;
    }
  }
  return AppDataSource;
}

export async function closeDataSource(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    logger.info("Database connection closed", "DB");
  }
}
