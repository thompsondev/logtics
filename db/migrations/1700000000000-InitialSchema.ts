import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1700000000000 implements MigrationInterface {
  name = "InitialSchema1700000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Enums ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM ('ADMIN', 'STAFF', 'CUSTOMER')
    `);
    await queryRunner.query(`
      CREATE TYPE "shipment_status_enum" AS ENUM (
        'CREATED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED_AT_HUB',
        'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_DELIVERY', 'RETURNED'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "shipping_method_enum" AS ENUM ('STANDARD', 'EXPRESS', 'OVERNIGHT', 'ECONOMY')
    `);
    await queryRunner.query(`
      CREATE TYPE "vehicle_status_enum" AS ENUM ('AVAILABLE', 'IN_USE', 'MAINTENANCE')
    `);
    await queryRunner.query(`
      CREATE TYPE "vehicle_type_enum" AS ENUM ('VAN', 'TRUCK', 'MOTORCYCLE', 'CAR', 'BICYCLE')
    `);

    // ─── users ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "firstName"   VARCHAR(100) NOT NULL,
        "lastName"    VARCHAR(100) NOT NULL,
        "email"       VARCHAR(255) NOT NULL UNIQUE,
        "password"    VARCHAR(255) NOT NULL,
        "role"        "user_role_enum" NOT NULL DEFAULT 'CUSTOMER',
        "phone"       VARCHAR(20),
        "isActive"    BOOLEAN NOT NULL DEFAULT TRUE,
        "avatarUrl"   VARCHAR(500),
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_role" ON "users" ("role")`);

    // ─── addresses ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "addresses" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "street"      VARCHAR(255) NOT NULL,
        "street2"     VARCHAR(100),
        "city"        VARCHAR(100) NOT NULL,
        "state"       VARCHAR(100),
        "country"     VARCHAR(100) NOT NULL,
        "postalCode"  VARCHAR(20) NOT NULL,
        "latitude"    DECIMAL(10, 7),
        "longitude"   DECIMAL(10, 7),
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_addresses_country_city" ON "addresses" ("country", "city")`);

    // ─── vehicles ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "vehicles" (
        "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "plateNumber"       VARCHAR(20) NOT NULL UNIQUE,
        "type"              "vehicle_type_enum" NOT NULL DEFAULT 'VAN',
        "model"             VARCHAR(100),
        "year"              INT,
        "capacityKg"        DECIMAL(8, 2) NOT NULL,
        "status"            "vehicle_status_enum" NOT NULL DEFAULT 'AVAILABLE',
        "currentDriverId"   UUID,
        "notes"             TEXT,
        "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_vehicles_plate" ON "vehicles" ("plateNumber")`);
    await queryRunner.query(`CREATE INDEX "IDX_vehicles_status" ON "vehicles" ("status")`);

    // ─── drivers ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "drivers" (
        "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId"              UUID NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
        "licenseNumber"       VARCHAR(50) NOT NULL UNIQUE,
        "phone"               VARCHAR(20),
        "isAvailable"         BOOLEAN NOT NULL DEFAULT TRUE,
        "isActive"            BOOLEAN NOT NULL DEFAULT TRUE,
        "currentVehicleId"    UUID REFERENCES "vehicles"("id"),
        "totalDeliveries"     INT NOT NULL DEFAULT 0,
        "successfulDeliveries" INT NOT NULL DEFAULT 0,
        "rating"              DECIMAL(4, 2) NOT NULL DEFAULT 0,
        "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_drivers_userId" ON "drivers" ("userId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_drivers_license" ON "drivers" ("licenseNumber")`);

    // Vehicle → current driver FK (added after drivers table exists)
    await queryRunner.query(`
      ALTER TABLE "vehicles" ADD CONSTRAINT "FK_vehicles_currentDriver"
        FOREIGN KEY ("currentDriverId") REFERENCES "drivers"("id") ON DELETE SET NULL
    `);

    // ─── shipments ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "shipments" (
        "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "trackingNumber"      VARCHAR(30) NOT NULL UNIQUE,
        "senderId"            UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "receiver"            JSONB NOT NULL,
        "originId"            UUID NOT NULL REFERENCES "addresses"("id") ON DELETE RESTRICT,
        "destinationId"       UUID NOT NULL REFERENCES "addresses"("id") ON DELETE RESTRICT,
        "status"              "shipment_status_enum" NOT NULL DEFAULT 'CREATED',
        "weightKg"            DECIMAL(8, 2) NOT NULL,
        "dimensions"          JSONB,
        "shippingMethod"      "shipping_method_enum" NOT NULL DEFAULT 'STANDARD',
        "price"               DECIMAL(10, 2) NOT NULL,
        "currency"            CHAR(3) NOT NULL DEFAULT 'USD',
        "estimatedDelivery"   TIMESTAMPTZ,
        "actualDelivery"      TIMESTAMPTZ,
        "driverId"            UUID REFERENCES "drivers"("id") ON DELETE SET NULL,
        "vehicleId"           UUID REFERENCES "vehicles"("id") ON DELETE SET NULL,
        "notes"               TEXT,
        "isFragile"           BOOLEAN NOT NULL DEFAULT FALSE,
        "requiresSignature"   BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_shipments_tracking" ON "shipments" ("trackingNumber")`);
    await queryRunner.query(`CREATE INDEX "IDX_shipments_status" ON "shipments" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_shipments_sender" ON "shipments" ("senderId")`);
    await queryRunner.query(`CREATE INDEX "IDX_shipments_createdAt" ON "shipments" ("createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_shipments_driver" ON "shipments" ("driverId")`);

    // ─── tracking_events ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "tracking_events" (
        "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "shipmentId"    UUID NOT NULL REFERENCES "shipments"("id") ON DELETE CASCADE,
        "status"        "shipment_status_enum" NOT NULL,
        "location"      VARCHAR(255),
        "description"   TEXT NOT NULL,
        "latitude"      DECIMAL(10, 7),
        "longitude"     DECIMAL(10, 7),
        "createdById"   UUID REFERENCES "users"("id") ON DELETE SET NULL,
        "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_tracking_shipment_date" ON "tracking_events" ("shipmentId", "createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_tracking_shipment" ON "tracking_events" ("shipmentId")`);

    // ─── audit_logs ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId"        UUID REFERENCES "users"("id") ON DELETE SET NULL,
        "action"        VARCHAR(100) NOT NULL,
        "resourceType"  VARCHAR(100),
        "resourceId"    UUID,
        "metadata"      JSONB,
        "ipAddress"     VARCHAR(45),
        "userAgent"     VARCHAR(500),
        "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_audit_userId" ON "audit_logs" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_action" ON "audit_logs" ("action")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_createdAt" ON "audit_logs" ("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tracking_events"`);
    await queryRunner.query(`ALTER TABLE "vehicles" DROP CONSTRAINT IF EXISTS "FK_vehicles_currentDriver"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "shipments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "drivers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vehicles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "addresses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "vehicle_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "vehicle_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "shipping_method_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "shipment_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);
  }
}
