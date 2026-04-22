// TypeORM CLI config — used by migration commands outside of Next.js
import "reflect-metadata";
import { DataSource } from "typeorm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { User } from "./src/modules/users/entities/user.entity";
import { Address } from "./src/modules/shipments/entities/address.entity";
import { Shipment } from "./src/modules/shipments/entities/shipment.entity";
import { TrackingEvent } from "./src/modules/tracking/entities/tracking-event.entity";
import { Driver } from "./src/modules/fleet/entities/driver.entity";
import { Vehicle } from "./src/modules/fleet/entities/vehicle.entity";
import { AuditLog } from "./src/modules/auth/entities/audit-log.entity";

export default new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME ?? "logtics",
  synchronize: false,
  logging: true,
  entities: [User, Address, Shipment, TrackingEvent, Driver, Vehicle, AuditLog],
  migrations: ["db/migrations/*.ts"],
});
