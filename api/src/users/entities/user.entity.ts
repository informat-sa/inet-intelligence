import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne,
  OneToMany, JoinColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { UserModulePermission } from './user-module-permission.entity';
import { Favorite } from '../../favorites/entities/favorite.entity';
import { UserTenantAccess } from './user-tenant-access.entity';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',  // Informat staff — all tenants, all modules
  ADMIN       = 'admin',        // Company admin — all modules of their tenant
  USER        = 'user',         // Regular employee — only permitted modules
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'varchar', default: UserRole.USER })
  role: UserRole;

  @Column({ nullable: true })
  tenantId: string;    // null for super_admin

  @ManyToOne(() => Tenant, { nullable: true, onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  invitedByUserId: string;

  @Column({ nullable: true })
  inviteToken: string;       // UUID token for first-login activation

  @Column({ nullable: true, type: 'timestamptz' })
  inviteExpiresAt: Date;

  @Column({ nullable: true })
  resetPasswordToken: string;   // UUID token for password reset

  @Column({ nullable: true, type: 'timestamptz' })
  resetPasswordExpires: Date;   // Expiry: 1h from request

  @Column({ nullable: true, type: 'timestamptz' })
  lastLoginAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => UserModulePermission, (p) => p.user, { cascade: true, eager: true })
  modulePermissions: UserModulePermission[];

  @OneToMany(() => Favorite, (f) => f.user)
  favorites: Favorite[];

  /** Additional tenant accesses granted by super_admin / admin */
  @OneToMany(() => UserTenantAccess, (a) => a.userId, { cascade: false, eager: false })
  tenantAccesses: UserTenantAccess[];
}
