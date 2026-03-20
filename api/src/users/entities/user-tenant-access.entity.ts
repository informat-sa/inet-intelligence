import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';

/**
 * Grants a user access to an additional tenant (empresa).
 * A user always has one primary tenant via User.tenantId.
 * This table records any extra companies the admin has opened up.
 */
@Entity('user_tenant_access')
export class UserTenantAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  tenantId: string;

  /** Eager-load the tenant so callers can read name/slug/logo without extra query */
  @ManyToOne(() => Tenant, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  /**
   * Module prefixes this user may query in THIS tenant context.
   * null = inherit the tenant's enabledModules list (no restriction).
   */
  @Column('simple-array', { nullable: true })
  allowedModules: string[] | null;

  /** Role inside this specific tenant ('admin' = all modules, 'user' = filtered) */
  @Column({ default: 'user' })
  role: 'admin' | 'user';

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
