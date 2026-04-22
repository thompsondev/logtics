import { z } from "zod";
import { ShipmentStatus, ShippingMethod } from "@/types";

const AddressInput = z.object({
  street: z.string().min(1).max(255).trim(),
  street2: z.string().max(100).optional(),
  city: z.string().min(1).max(100).trim(),
  state: z.string().max(100).optional(),
  country: z.string().min(2).max(100).trim(),
  postalCode: z.string().min(1).max(20).trim(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

const ReceiverInput = z.object({
  name: z.string().min(1).max(200).trim(),
  email: z.string().email(),
  phone: z.string().min(1).max(20).trim(),
  company: z.string().max(200).optional(),
});

export const CreateShipmentDto = z.object({
  receiver: ReceiverInput,
  origin: AddressInput,
  destination: AddressInput,
  weightKg: z.number().positive().max(10000),
  dimensions: z
    .object({
      length: z.number().positive(),
      width: z.number().positive(),
      height: z.number().positive(),
      unit: z.enum(["cm", "in"]),
    })
    .optional(),
  shippingMethod: z.nativeEnum(ShippingMethod).default(ShippingMethod.STANDARD),
  estimatedDelivery: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
  isFragile: z.boolean().default(false),
  requiresSignature: z.boolean().default(false),
  currency: z.string().length(3).default("USD"),
});

export const UpdateShipmentDto = z.object({
  receiver: ReceiverInput.partial().optional(),
  notes: z.string().max(1000).optional(),
  estimatedDelivery: z.string().datetime().optional(),
  isFragile: z.boolean().optional(),
  requiresSignature: z.boolean().optional(),
  driverId: z.string().uuid().nullable().optional(),
  vehicleId: z.string().uuid().nullable().optional(),
});

export const UpdateStatusDto = z.object({
  status: z.nativeEnum(ShipmentStatus),
  location: z.string().max(255).optional(),
  description: z.string().max(1000).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const ListShipmentsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(ShipmentStatus).optional(),
  shippingMethod: z.nativeEnum(ShippingMethod).optional(),
  search: z.string().max(100).optional(),
  senderId: z.string().uuid().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "status", "price"]).default("createdAt"),
  sortOrder: z.enum(["ASC", "DESC"]).default("DESC"),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type CreateShipmentInput = z.infer<typeof CreateShipmentDto>;
export type UpdateShipmentInput = z.infer<typeof UpdateShipmentDto>;
export type UpdateStatusInput = z.infer<typeof UpdateStatusDto>;
export type ListShipmentsInput = z.infer<typeof ListShipmentsQuery>;
