import { Repository } from "typeorm";
import { User } from "@/modules/users/entities/user.entity";
import { RegisterInput } from "@/modules/auth/dtos/auth.dto";
import { UserRole } from "@/types";

export class UserService {
  constructor(private readonly repo: Repository<User>) {}

  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id, isActive: true } });
  }

  async findByEmail(id: string, withPassword = false): Promise<User | null> {
    const qb = this.repo
      .createQueryBuilder("user")
      .where("user.email = :email AND user.isActive = true", { email: id });
    if (withPassword) qb.addSelect("user.password");
    return qb.getOne();
  }

  async create(input: RegisterInput): Promise<User> {
    const existing = await this.findByEmail(input.email);
    if (existing) throw new Error("Email already registered");

    // Only allow ADMIN to create ADMIN/STAFF via this service;
    // public registration is always CUSTOMER — enforced at route layer.
    const user = this.repo.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      password: input.password, // hashed by @BeforeInsert
      role: input.role ?? UserRole.CUSTOMER,
      phone: input.phone ?? null,
    });

    return this.repo.save(user);
  }

  async list(page: number, pageSize: number, search?: string, role?: UserRole) {
    const qb = this.repo
      .createQueryBuilder("u")
      .orderBy("u.createdAt", "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (search) {
      qb.andWhere(
        "(u.firstName ILIKE :q OR u.lastName ILIKE :q OR u.email ILIKE :q)",
        { q: `%${search}%` },
      );
    }
    if (role) {
      qb.andWhere("u.role = :role", { role });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async deactivate(id: string): Promise<void> {
    await this.repo.update(id, { isActive: false });
  }

  async updateRole(id: string, role: UserRole): Promise<User> {
    await this.repo.update(id, { role });
    return this.repo.findOneOrFail({ where: { id } });
  }

  // Strips password and private fields from the returned object
  sanitize(user: User): Record<string, unknown> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, comparePassword, hashPasswordOnInsert, hashPasswordOnUpdate, _passwordChanged, ...safe } =
      user as User & { password: string };
    return safe;
  }
}
