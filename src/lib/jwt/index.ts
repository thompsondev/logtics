import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { env } from "@/config/env";
import { JwtPayload } from "@/types";

/**
 * Access tokens also carry a jti so they can be individually blocked on logout.
 */
export function signAccessToken(payload: Omit<JwtPayload, "iat" | "exp" | "jti">): string {
  const jti = uuidv4();
  return jwt.sign({ ...payload, jti }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

/**
 * Refresh tokens carry a unique `jti` so they can be individually revoked.
 * The jti is stored in Redis at issuance; on use the old jti is deleted and
 * a new token (with new jti) is issued — single-use rotation.
 */
export function signRefreshToken(
  payload: Omit<JwtPayload, "iat" | "exp" | "jti">,
): { token: string; jti: string } {
  const jti = uuidv4();
  const token = jwt.sign({ ...payload, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
  return { token, jti };
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}

export function decodeToken(token: string): JwtPayload | null {
  return jwt.decode(token) as JwtPayload | null;
}
