import { DataSource } from "typeorm";
import { User } from "@/modules/users/entities/user.entity";
import { AuditLog } from "@/modules/auth/entities/audit-log.entity";
import { UserService } from "@/modules/users/services/user.service";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/jwt";
import { RegisterInput, LoginInput } from "@/modules/auth/dtos/auth.dto";
import { AUDIT_ACTIONS } from "@/config/constants";

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
    const tokens = this.issueTokens(user);
    await this.audit(user.id, AUDIT_ACTIONS.USER_CREATED, ipAddress);
    return { user: this.userService.sanitize(user), tokens };
  }

  async login(input: LoginInput, ipAddress?: string): Promise<AuthResult> {
    const user = await this.userService.findByEmail(input.email, true);

    if (!user) throw new Error("Invalid credentials");

    const valid = await user.comparePassword(input.password);
    if (!valid) throw new Error("Invalid credentials");

    if (!user.isActive) throw new Error("Account is deactivated");

    const tokens = this.issueTokens(user);
    await this.audit(user.id, AUDIT_ACTIONS.USER_LOGIN, ipAddress);
    return { user: this.userService.sanitize(user), tokens };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = verifyRefreshToken(refreshToken);
    const user = await this.userService.findById(payload.sub);
    if (!user) throw new Error("User not found");
    return this.issueTokens(user);
  }

  async me(userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new Error("User not found");
    return this.userService.sanitize(user);
  }

  private issueTokens(user: User): TokenPair {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
    };
  }

  private async audit(userId: string, action: string, ipAddress?: string) {
    const repo = this.ds.getRepository(AuditLog);
    const log = repo.create({ userId, action, ipAddress: ipAddress ?? null });
    await repo.save(log).catch(() => null); // non-critical — never fail the request
  }
}
