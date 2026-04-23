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

  @Column({ type: "uuid", nullable: true })
  userId: string | null;

  @Column({ type: "varchar", length: 100 })
  action: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  resourceType: string | null;

  @Column({ type: "uuid", nullable: true })
  resourceId: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata: AuditMetadata | null;

  @Column({ type: "varchar", length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
