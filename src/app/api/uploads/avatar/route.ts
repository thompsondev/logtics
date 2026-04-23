/**
 * POST /api/uploads/avatar
 *
 * Accepts a multipart/form-data body with a single "file" field.
 * Validates file type + size, uploads to Cloudinary under logtics/avatars/,
 * updates the user's avatarUrl in the DB, and returns the new URL.
 *
 * Limits:
 *   - Images only (jpeg, png, webp, gif)
 *   - Max 5 MB
 */

import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db";
import { User } from "@/modules/users/entities/user.entity";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { uploadFile, deleteFile } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export const POST = withAuth(async (req: AuthedRequest) => {
  // 10 uploads per minute per user
  const throttled = await rateLimit(req, { prefix: "uploads:avatar", windowSec: 60, max: 10 });
  if (throttled) return throttled;

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return badRequest("No file provided — send a multipart/form-data body with a 'file' field");
    }

    // ── Validate type ───────────────────────────────────────────────────────
    if (!ALLOWED_TYPES.has(file.type)) {
      return badRequest(`File type '${file.type}' is not allowed. Accepted: jpeg, png, webp, gif`);
    }

    // ── Validate size ────────────────────────────────────────────────────────
    if (file.size > MAX_BYTES) {
      return badRequest(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // ── Delete old avatar (best-effort) ──────────────────────────────────────
    const ds = await getDataSource();
    const userRepo = ds.getRepository(User);
    const user = await userRepo.findOne({ where: { id: req.user.id } });

    if (user?.avatarUrl) {
      // Extract the public_id from the stored URL if it looks like a Cloudinary URL
      const existingPublicId = extractCloudinaryPublicId(user.avatarUrl);
      if (existingPublicId) {
        await deleteFile(existingPublicId).catch(() => null); // non-fatal
      }
    }

    // ── Upload to Cloudinary ─────────────────────────────────────────────────
    const ext = file.type.split("/")[1];                        // e.g. "jpeg"
    const filename = `user_${req.user.id}.${ext}`;

    const result = await uploadFile("avatars", filename, buffer, file.type, {
      resourceType: "image",
      transformation: [
        // Crop to square, 400×400 max — fast delivery + consistent layout
        { width: 400, height: 400, crop: "fill", gravity: "face" },
      ],
    });

    // ── Persist the new URL ──────────────────────────────────────────────────
    await userRepo.update(req.user.id, { avatarUrl: result.url });

    return ok({
      url: result.url,
      publicId: result.publicId,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
    });
  } catch (err) {
    console.error("[uploads:avatar]", err);
    return serverError("Failed to upload avatar");
  }
});

/**
 * Extracts the Cloudinary public_id from a secure_url.
 * e.g. "https://res.cloudinary.com/demo/image/upload/v123/logtics/avatars/user_abc.jpg"
 *   → "logtics/avatars/user_abc"
 */
function extractCloudinaryPublicId(url: string): string | null {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
