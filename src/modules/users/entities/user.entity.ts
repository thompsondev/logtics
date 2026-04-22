import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from "typeorm";
import bcrypt from "bcryptjs";
import { UserRole } from "@/types";

@Entity("users")
@Index(["email"], { unique: true })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ length: 100 })
  firstName: string;

  @Column({ length: 100 })
  lastName: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ select: false })
  password: string;

  @Column({ type: "enum", enum: UserRole, default: UserRole.CUSTOMER })
  role: UserRole;

  @Column({ length: 20, nullable: true })
  phone: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true, length: 500 })
  avatarUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations populated by other modules
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @OneToMany("Shipment", "sender")
  shipments: any[];

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  /**
   * Transient flag — set to true by callers that have just assigned a NEW
   * plain-text password to `this.password`.  This prevents the bcrypt guard
   * from re-hashing an already-hashed password when TypeORM fires @BeforeUpdate
   * on unrelated field changes (e.g. avatarUrl update).
   *
   * The `_` prefix and `!` column-less decorator keeps TypeORM from persisting
   * this field.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _passwordChanged = false;

  @BeforeInsert()
  async hashPasswordOnInsert() {
    if (this.password) {
      this.password = await bcrypt.hash(this.password, 12);
      this._passwordChanged = false;
    }
  }

  @BeforeUpdate()
  async hashPasswordOnUpdate() {
    if (this._passwordChanged && this.password) {
      this.password = await bcrypt.hash(this.password, 12);
      this._passwordChanged = false;
    }
  }

  async comparePassword(plain: string): Promise<boolean> {
    return bcrypt.compare(plain, this.password);
  }
}
