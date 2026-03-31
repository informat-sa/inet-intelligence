import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { MailService } from '../mail/mail.service';
import { User, UserRole } from '../users/entities/user.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { Tenant } from '../tenants/entities/tenant.entity';

const ALL_MODULES = ['VFA','CCC','ADQ','IMP','EXI','PRO','AFF','REM','CON','SII','PAR','DDI','FIN','GAN','ATE','BAN','EGR','COT','PED'];

// Module display names
const MODULE_NAMES: Record<string, string> = {
  VFA: 'Ventas y Facturación', CCC: 'Cuentas por Cobrar',
  ADQ: 'Adquisiciones', IMP: 'Importaciones',
  EXI: 'Existencias', PRO: 'Productos',
  AFF: 'Activo Fijo', REM: 'Remuneraciones',
  CON: 'Contabilidad', SII: 'SII / Tributario',
  PAR: 'Parámetros', DDI: 'Despacho',
  FIN: 'Finanzas', GAN: 'Granos', ATE: 'Atención Clientes',
};

export interface AccessibleTenantDto {
  id:          string;
  slug:        string;
  name:        string;
  logoUrl:     string | null;
  moduleCount: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive || !user.passwordHash) return null;

    const valid = await this.usersService.validatePassword(user, password);
    return valid ? user : null;
  }

  async login(user: User): Promise<{
    access_token: string;
    user: ReturnType<AuthService['toUserDto']>;
    accessibleTenants: AccessibleTenantDto[];
  }> {
    const allowedModules = await this.resolveAllowedModules(user);

    let tenant = user.tenant;
    if (!tenant && user.tenantId) {
      tenant = (await this.tenantsService.findById(user.tenantId)) ?? undefined as any;
    }

    const payload: JwtPayload = {
      sub:            user.id,
      email:          user.email,
      role:           user.role,
      tenantId:       user.tenantId ?? null,
      tenantSlug:     tenant?.slug ?? null,
      tenantName:     tenant?.name ?? null,
      allowedModules,
    };

    await this.usersService.updateLastLogin(user.id);

    const accessibleTenants = await this.buildAccessibleTenants(user);

    return {
      access_token: this.jwtService.sign(payload),
      user: this.toUserDto(user, allowedModules, tenant),
      accessibleTenants,
    };
  }

  /**
   * Switch tenant context — validates the user has access to the requested
   * tenant, then issues a fresh JWT scoped to that company.
   */
  async selectTenant(currentUser: JwtPayload, tenantId: string): Promise<{
    access_token: string;
    user: ReturnType<AuthService['toUserDto']>;
    accessibleTenants: AccessibleTenantDto[];
  }> {
    const user = await this.usersService.findById(currentUser.sub);
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    // Super admin can switch to any active tenant
    if (user.role !== UserRole.SUPER_ADMIN) {
      const accessible = await this.buildAccessibleTenants(user);
      const hasAccess  = accessible.some((t) => t.id === tenantId);
      if (!hasAccess) throw new UnauthorizedException('Sin acceso a esta empresa');
    }

    const tenant = await this.tenantsService.findById(tenantId);
    if (!tenant || !tenant.isActive) {
      throw new UnauthorizedException('Empresa no disponible o inactiva');
    }

    // Resolve modules for this tenant context
    let allowedModules: string[];
    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
      allowedModules = tenant.enabledModules ?? ALL_MODULES;
    } else {
      // Check for per-access module overrides
      const accesses    = await this.usersService.getAccessibleTenants(user.id);
      const tenantAccess = accesses.find((a) => a.tenantId === tenantId);
      if (tenantAccess?.allowedModules?.length) {
        allowedModules = tenantAccess.allowedModules;
      } else {
        // Fall back to the user's own module permissions
        allowedModules = (user.modulePermissions ?? [])
          .filter((p) => p.enabled)
          .map((p) => p.modulePrefix);
      }
    }

    const payload: JwtPayload = {
      sub:            user.id,
      email:          user.email,
      role:           user.role,
      tenantId:       tenant.id,
      tenantSlug:     tenant.slug,
      tenantName:     tenant.name,
      allowedModules,
    };

    const accessibleTenants = await this.buildAccessibleTenants(user);

    return {
      access_token: this.jwtService.sign(payload),
      user:         this.toUserDto(user, allowedModules, tenant),
      accessibleTenants,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async resolveAllowedModules(user: User): Promise<string[]> {
    if (user.role === UserRole.SUPER_ADMIN) return ALL_MODULES;

    if (user.role === UserRole.ADMIN) {
      let tenant = user.tenant;
      if (!tenant && user.tenantId) {
        tenant = (await this.tenantsService.findById(user.tenantId)) as any;
      }
      return tenant?.enabledModules ?? ALL_MODULES;
    }

    return (user.modulePermissions ?? [])
      .filter((p) => p.enabled)
      .map((p) => p.modulePrefix);
  }

  /**
   * Builds the complete list of companies a user can access.
   * Combines: primary tenant (User.tenantId) + extra grants (UserTenantAccess).
   */
  async buildAccessibleTenants(user: User): Promise<AccessibleTenantDto[]> {
    const tenants: AccessibleTenantDto[] = [];

    // Super admin: return first 20 active tenants
    if (user.role === UserRole.SUPER_ADMIN) {
      const all = await this.tenantsService.findAll();
      return all.slice(0, 20).map((t) => this.toAccessibleTenantDto(t));
    }

    // Primary tenant
    if (user.tenantId) {
      let t: Tenant | null | undefined = user.tenant;
      if (!t) t = await this.tenantsService.findById(user.tenantId);
      if (t && t.isActive) tenants.push(this.toAccessibleTenantDto(t));
    }

    // Extra tenants via UserTenantAccess
    const accesses = await this.usersService.getAccessibleTenants(user.id);
    for (const access of accesses) {
      const alreadyListed = tenants.some((t) => t.id === access.tenantId);
      if (!alreadyListed && access.tenant?.isActive) {
        tenants.push(this.toAccessibleTenantDto(access.tenant));
      }
    }

    return tenants;
  }

  private toAccessibleTenantDto(t: Tenant): AccessibleTenantDto {
    return {
      id:          t.id,
      slug:        t.slug,
      name:        t.name,
      logoUrl:     t.logoUrl ?? null,
      moduleCount: t.enabledModules?.length ?? 0,
    };
  }

  toUserDto(user: User, allowedModules: string[], tenant?: any) {
    return {
      id:         user.id,
      name:       user.name,
      email:      user.email,
      role:       user.role,
      tenantId:   user.tenantId ?? null,
      empresa:    tenant?.name ?? 'Demo',
      tenantSlug: tenant?.slug ?? null,
      avatarUrl:  user.avatarUrl ?? null,
      modules:    allowedModules,
      modulePermissions: allowedModules.map((prefix) => ({
        modulePrefix: prefix,
        moduleName:   MODULE_NAMES[prefix] ?? prefix,
        enabled:      true,
      })),
    };
  }

  /** Validate invite token and return user */
  async validateInviteToken(token: string): Promise<User | null> {
    const user = await this.usersService.findByInviteToken(token);
    if (!user) return null;
    if (!user.inviteExpiresAt || user.inviteExpiresAt < new Date()) return null;
    return user;
  }

  /**
   * Forgot password — generate a reset token and send email.
   * Always returns { ok: true } even if email not found (security: avoid enumeration).
   */
  async forgotPassword(email: string): Promise<{ ok: true }> {
    const portalUrl = process.env.PORTAL_URL ?? 'http://localhost:3000';
    const user      = await this.usersService.findByEmail(email);

    if (user && user.isActive) {
      const token    = await this.usersService.saveResetToken(user.id);
      const resetUrl = `${portalUrl}/reset-password/${token}`;

      await this.mailService.sendPasswordResetEmail({
        to:     user.email,
        toName: user.name,
        resetUrl,
      });
    }
    return { ok: true };
  }

  /**
   * Reset password — validate token, apply new password.
   */
  async resetPassword(token: string, newPassword: string): Promise<{ ok: true }> {
    const user = await this.usersService.findByResetToken(token);
    if (!user) throw new NotFoundException('El link de recuperación es inválido o ha expirado');

    await this.usersService.applyPasswordReset(user.id, newPassword);
    return { ok: true };
  }
}
