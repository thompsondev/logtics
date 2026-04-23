import bcrypt from "bcryptjs";
import { DataSource } from "typeorm";
import { User } from "@/modules/users/entities/user.entity";
import { AuditLog } from "@/modules/auth/entities/audit-log.entity";
import { UserService } from "@/modules/users/services/user.service";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/jwt";
import { RegisterInput, LoginInput } from "@/modules/auth/dtos/auth.dto";
import { AUDIT_ACTIONS } from "@/config/constants";
import {
  storeRefreshJti,
  consumeRefreshJti,
  revokeRefreshJti,
  blockAccessToken,
  recordFailedLogin,
  isAccountLocked,
  clearFailedLogins,
} from "@/lib/redis";

// A pre-computed bcrypt hash used as a dummy comparison target when the
// requested email does not exist.  This makes failed lookups take the same
// wall-clock time as a real bcrypt.compare, preventing user-enumeration via
// timing side-channels.
// Must be a properly-formed 60-char bcrypt hash so bcryptjs can extract a
// valid salt and run a real comparison (otherwise it may short-circuit and
// return faster, leaking the "user not found" branch via timing).
const DUMMY_HASH = "$2b$12$GvFKOzDNEoJDkYPDDAothOZT6V6OgGNEbgzPRfqmH/DEqhWs/pKI2";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: Record<string, unknown>;
  tokens: TokenPair;
}

export class AuthService {
  private readonly userService: UserService;

  constructor(private readonly ds: DataSource) {
    this.userService = new UserService(ds.getRepository(User));
  }

  async register(input: RegisterInput, ipAddress?: string): Promise<AuthResult> {
    const user = await this.userService.create(input);
    const tokens = await this.issueTokens(user);
    await this.audit(user.id, AUDIT_ACTIONS.USER_CREATED, ipAddress);
    return { user: this.userService.sanitize(user), tokens };
  }

  async login(input: LoginInput, ipAddress?: string): Promise<AuthResult> {
    // ── Check account lockout before hitting the DB ───────────────────────
    const locked = await isAccountLocked(input.email).catch(() => false);
    if (locked) throw new Error("Account temporarily locked. Try again later.");

    const user = await this.userService.findByEmail(input.email, true);

    // Always run bcrypt even when the user doesn't exist — prevents timing
    // attacks that would let an attacker enumerate valid email addresses.
    const hashToCompare = user?.password ?? DUMMY_HASH;
    const valid = await bcrypt.compare(input.password, hashToCompare);

    if (!user || !valid) {
      // Record the failure against this email (fire-and-forget, non-fatal)
      recordFailedLogin(input.email).catch(() => null);
      throw new Error("Invalid credentials");
    }

    if (!user.isActive) throw new Error("Account is deactivated");

    // Clear failure counter on successful login
    await clearFailedLogins(input.email).catch(() => null);

    const tokens = await this.issueTokens(user);
    await this.audit(user.id, AUDIT_ACTIONS.USER_LOGIN, ipAddress);
    return { user: this.userService.sanitize(user), tokens };
  }

  /**
   * Exchange a valid refresh token for a new token pair.
   * Single-use rotation: the old jti is consumed (deleted) before the new
   * pair is issued, preventing replay attacks.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = verifyRefreshToken(refreshToken);

    if (!payload.jti) throw new Error("Malformed refresh token");

    // Consume the jti — if it returns null the token was already used or revoked
    const userId = await consumeRefreshJti(payload.jti);
    if (!userId) throw new Error("Refresh token already used or revoked");

    const user = await this.userService.findById(userId);
    if (!user) throw new Error("User not found");

    return this.issueTokens(user);
  }

  /**
   * Invalidate both tokens on logout.
   * - Access token jti is added to the Redis blocklist until its natural expiry
   * - Refresh token jti is deleted from the allowlist
   */
  async logout(accessToken: string, refreshToken?: string): Promise<void> {
    // Block the access token
    try {
      const { verifyAccessToken } = await import("@/lib/jwt");
      const payload = verifyAccessToken(accessToken);
      if (payload.jti && payload.exp) {
        const remaining = payload.exp - Math.floor(Date.now() / 1000);
        if (remaining > 0) {
          await blockAccessToken(payload.jti, remaining);
        }
      }
    } catch {
      // Token already expired — nothing to block
    }

    // Revoke the refresh token jti
    if (refreshToken) {
      try {
        const { verifyRefreshToken } = await import("@/lib/jwt");
        const payload = verifyRefreshToken(refreshToken);
        if (payload.jti) await revokeRefreshJti(payload.jti);
      } catch {
        // Already expired or malformed — safe to ignore
      }
    }
  }

  async me(userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new Error("User not found");
    return this.userService.sanitize(user);
  }

  private async issueTokens(user: User): Promise<TokenPair> {
    const basePayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(basePayload);
    const { token: refreshToken, jti } = signRefreshToken(basePayload);

    // Persist the jti so we can verify it on the next refresh call
    await storeRefreshJti(user.id, jti).catch(() => null); // non-fatal if Redis is down

    return { accessToken, refreshToken };
  }

  private async audit(userId: string, action: string, ipAddress?: string) {
    const repo = this.ds.getRepository(AuditLog);
    const log = repo.create({ userId, action, ipAddress: ipAddress ?? null });
    await repo.save(log).catch(() => null); // non-critical — never fail the request
  }
}
