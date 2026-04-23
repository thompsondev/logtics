/**
 * Cloudinary storage service.
 *
 * Replaces the S3 implementation with the same public interface so callers
 * don't need to know which provider is in use.
 *
 * Features leveraged:
 *  - Auto format   (serves avif/webp based on browser Accept header)
 *  - Auto quality  (visually lossless at ~70–80 % smaller file size)
 *  - Named folder  (assets organised as logtics/<folder>/<filename>)
 *  - Secure HTTPS URLs always
 */

import { v2 as cloudinary, UploadApiOptions, UploadApiResponse } from "cloudinary";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";

let configured = false;

function configure() {
  if (configured) return;
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    logger.warn("Cloudinary credentials not set — uploads will fail", "Storage");
    return;
  }
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
}

export interface UploadOptions {
  /** Cloudinary resource type. Default: "auto" */
  resourceType?: "image" | "video" | "raw" | "auto";
  /** Apply a named transformation defined in your Cloudinary dashboard */
  transformation?: UploadApiOptions["transformation"];
  /** Override the generated public_id */
  publicId?: string;
}

export interface UploadResult {
  /** Full HTTPS URL — use this to display / download the asset */
  url: string;
  /** Cloudinary public_id — store this in your DB to delete/transform later */
  publicId: string;
  /** Width in px (images only) */
  width?: number;
  /** Height in px (images only) */
  height?: number;
  /** Bytes */
  bytes: number;
  /** e.g. "jpg", "png", "pdf" */
  format: string;
}

/**
 * Upload a file buffer to Cloudinary.
 *
 * @param folder    Logical folder, e.g. "avatars" | "documents"
 * @param filename  Base filename without extension, e.g. "user_abc123"
 * @param buffer    Raw file bytes
 * @param mimeType  MIME type, e.g. "image/jpeg"
 * @param opts      Optional Cloudinary upload options
 */
export async function uploadFile(
  folder: string,
  filename: string,
  buffer: Buffer,
  mimeType: string,
  opts: UploadOptions = {},
): Promise<UploadResult> {
  configure();

  const publicId = opts.publicId ?? `logtics/${folder}/${filename}`;

  const uploadOptions: UploadApiOptions = {
    public_id: publicId,
    resource_type: opts.resourceType ?? "auto",
    overwrite: true,
    // Auto quality + format — Cloudinary picks the best encoding per browser
    quality: "auto",
    fetch_format: "auto",
    ...(opts.transformation ? { transformation: opts.transformation } : {}),
  };

  // Cloudinary SDK doesn't accept Buffer directly — wrap in a data URI
  const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;

  const result: UploadApiResponse = await cloudinary.uploader.upload(dataUri, uploadOptions);

  logger.info(`Uploaded ${publicId} (${result.bytes} bytes)`, "Storage");

  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
    format: result.format,
  };
}

/**
 * Delete a file from Cloudinary by its public_id.
 * Silently succeeds if the asset doesn't exist.
 */
export async function deleteFile(publicId: string): Promise<void> {
  configure();
  await cloudinary.uploader.destroy(publicId, { invalidate: true });
  logger.info(`Deleted ${publicId}`, "Storage");
}

/**
 * Build a transformation URL without uploading anything.
 * Useful for generating on-the-fly resized thumbnails.
 *
 * @example
 *   transformUrl("logtics/avatars/user_abc", { width: 64, height: 64, crop: "fill" })
 */
export function transformUrl(
  publicId: string,
  options: { width?: number; height?: number; crop?: string },
): string {
  configure();
  return cloudinary.url(publicId, { ...options, secure: true, fetch_format: "auto", quality: "auto" });
}
