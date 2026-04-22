import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

/**
 * Structured audit metadata — prefer known fields over open-ended records so
 * TypeScript forces callers to be intentional about what they log.
 */
export interface AuditMetadata {
  from?: string;
  to?: string;
  fields?: string[];
  reason?: string;
  /** Catch-all for any extra context not covered above */
  extra?: Record<string, unknown>;
}

@Entity("audit_logs")
@Index(["userId"])
@Index(["action"])
@Index(["createdAt"])
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ nullable: true, length: 36 })
  userId: string | null;

  @Column({ length: 100 })
  action: string;

  @Column({ length: 100, nullable: true })
  resourceType: string | null;

  @Column({ nullable: true, length: 36 })
  resourceId: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata: AuditMetadata | null;

  @Column({ length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ length: 500, nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
