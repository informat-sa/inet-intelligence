import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserRole } from './entities/user.entity';
import { UserModulePermission } from './entities/user-module-permission.entity';
import { UserTenantAccess } from './entities/user-tenant-access.entity';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserModulePermission)
    private readonly permRepo: Repository<UserModulePermission>,
    @InjectRepository(UserTenantAccess)
    private readonly tenantAccessRepo: Repository<UserTenantAccess>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { email: email.toLowerCase() },
      relations: ['tenant', 'modulePermissions'],
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
      relations: ['tenant', 'modulePermissions'],
    });
  }

  async findByInviteToken(token: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { inviteToken: token },
      relations: ['tenant', 'modulePermissions'],
    });
  }

  async findByTenant(tenantId: string): Promise<User[]> {
    return this.userRepo.find({
      where: { tenantId },
      relations: ['modulePermissions'],
      order: { createdAt: 'ASC' },
    });
  }

  async createAdmin(data: {
    name: string;
    email: string;
    password: string;
    tenantId: string;
    role?: UserRole;
  }): Promise<User> {
    const existing = await this.findByEmail(data.email);
    if (existing) throw new ConflictException('El email ya está registrado');

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const user = this.userRepo.create({
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash,
      role: data.role ?? UserRole.ADMIN,
      tenantId: data.tenantId,
      isActive: true,
    });
    return this.userRepo.save(user);
  }

  async createSuperAdmin(data: { name: string; email: string; password: string }): Promise<User> {
    const existing = await this.findByEmail(data.email);
    if (existing) throw new ConflictException('El email ya está registrado');

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const user = this.userRepo.create({
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      tenantId: null as any,
      isActive: true,
    });
    return this.userRepo.save(user);
  }

  /** Generate invite token, save user as pending activation */
  async createInvite(data: {
    email: string;
    name?: string;
    tenantId: string;
    invitedByUserId: string;
    modulePermissions: string[];
  }): Promise<User> {
    const existing = await this.findByEmail(data.email);
    if (existing) throw new ConflictException('El email ya está registrado');

    const inviteToken = crypto.randomUUID();
    const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

    const user = this.userRepo.create({
      name: data.name ?? '',     // empty until accepted (user sets name on accept)
      email: data.email.toLowerCase(),
      passwordHash: '',          // empty until accept
      role: UserRole.USER,
      tenantId: data.tenantId,
      isActive: false,
      invitedByUserId: data.invitedByUserId,
      inviteToken,
      inviteExpiresAt,
    });
    const saved = await this.userRepo.save(user);

    // Set module permissions
    await this.setPermissions(saved.id, data.modulePermissions);
    return this.findById(saved.id) as Promise<User>;
  }

  /** Accept invite: set name + password, activate user */
  async acceptInvite(token: string, name: string, password: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { inviteToken: token } });
    if (!user) throw new NotFoundException('Token de invitación inválido');
    if (user.inviteExpiresAt < new Date()) {
      throw new ConflictException('El link de invitación ha expirado');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await this.userRepo.update(user.id, {
      name,
      passwordHash,
      isActive: true,
      inviteToken: null as any,       // NULL so the token can't be replayed
      inviteExpiresAt: null as any,
    });
    return this.findById(user.id) as Promise<User>;
  }

  async setPermissions(userId: string, modulePrefixes: string[]): Promise<void> {
    await this.permRepo.delete({ userId });
    const perms = modulePrefixes.map((p) =>
      this.permRepo.create({ userId, modulePrefix: p, enabled: true }),
    );
    await this.permRepo.save(perms);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepo.update(userId, { lastLoginAt: new Date() });
  }

  async setActive(userId: string, isActive: boolean): Promise<void> {
    await this.userRepo.update(userId, { isActive });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async resendInvite(userId: string): Promise<User> {
    const inviteToken = crypto.randomUUID();
    const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await this.userRepo.update(userId, { inviteToken, inviteExpiresAt });
    return this.findById(userId) as Promise<User>;
  }

  /** Generate a password-reset token (1 h TTL) and persist it */
  async saveResetToken(userId: string): Promise<string> {
    const resetPasswordToken   = crypto.randomUUID();
    const resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 h
    await this.userRepo.update(userId, { resetPasswordToken, resetPasswordExpires });
    return resetPasswordToken;
  }

  /** Find an active (non-expired) reset token */
  async findByResetToken(token: string): Promise<User | null> {
    const user = await this.userRepo.findOne({ where: { resetPasswordToken: token } });
    if (!user) return null;
    if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) return null;
    return user;
  }

  // ── Multi-empresa (tenant access) ─────────────────────────────────────────

  /** Return all additional tenant accesses for a user */
  async getAccessibleTenants(userId: string): Promise<UserTenantAccess[]> {
    return this.tenantAccessRepo.find({
      where: { userId, isActive: true },
      // tenant is eager-loaded by the entity definition
    });
  }

  /** Grant (or re-activate) access to an extra tenant for a user */
  async grantTenantAccess(
    userId: string,
    tenantId: string,
    role: 'admin' | 'user' = 'user',
    allowedModules: string[] | null = null,
  ): Promise<UserTenantAccess> {
    const existing = await this.tenantAccessRepo.findOne({ where: { userId, tenantId } });
    if (existing) {
      existing.isActive     = true;
      existing.role         = role;
      existing.allowedModules = allowedModules;
      return this.tenantAccessRepo.save(existing);
    }
    return this.tenantAccessRepo.save(
      this.tenantAccessRepo.create({ userId, tenantId, role, allowedModules, isActive: true }),
    );
  }

  /** Revoke access to an extra tenant */
  async revokeTenantAccess(userId: string, tenantId: string): Promise<void> {
    await this.tenantAccessRepo.update({ userId, tenantId }, { isActive: false });
  }

  /** Apply new password and clear the reset token */
  async applyPasswordReset(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.userRepo.update(userId, {
      passwordHash,
      resetPasswordToken:   undefined as any,
      resetPasswordExpires: undefined as any,
    });
  }
}
