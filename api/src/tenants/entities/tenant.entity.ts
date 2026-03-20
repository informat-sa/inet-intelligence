import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;               // URL-safe, e.g. "ferreteria-central"

  @Column()
  name: string;               // "Ferretería Central SpA"

  @Column({ nullable: true })
  taxId: string;              // RUT empresa

  @Column({ nullable: true })
  logoUrl: string;

  // ── SQL Server connection (password stored encrypted) ──────────────
  @Column({ default: 'localhost' })
  dbServer: string;

  @Column({ default: 1433 })
  dbPort: number;

  @Column({ default: 'INET_STD' })
  dbDatabase: string;

  @Column({ default: '' })
  dbUser: string;

  @Column({ default: '' })
  dbPasswordEncrypted: string;

  @Column({ default: false })
  dbEncrypt: boolean;

  @Column({ default: true })
  dbTrustCert: boolean;

  // ── Modules enabled for this tenant ───────────────────────────────
  @Column('simple-array', { default: 'VFA,CCC,ADQ,EXI,PRO,REM,CON,SII' })
  enabledModules: string[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
