import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("addresses")
@Index(["country", "city"])
export class Address {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ length: 255 })
  street: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  street2: string | null;

  @Column({ length: 100 })
  city: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  state: string | null;

  @Column({ length: 100 })
  country: string;

  @Column({ length: 20 })
  postalCode: string;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  @CreateDateColumn()
  createdAt: Date;

  get formatted(): string {
    const parts = [this.street, this.city, this.state, this.postalCode, this.country].filter(
      Boolean,
    );
    return parts.join(", ");
  }
}
