/**
 * Demo auth controller — used when no PostgreSQL is configured (DEMO_MODE).
 * Accepts any credentials and returns a real signed JWT with all modules.
 * Includes two demo "empresas" so the multi-company selector can be demoed.
 */
import { Controller, Post, Body, Get, Req, Query, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Public } from './decorators/public.decorator';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

const ALL_MODULES = ['VFA','CCC','ADQ','IMP','EXI','PRO','AFF','REM','CON','SII','PAR','DDI','FIN','GAN','ATE','BAN','EGR','COT','PED'];

/** Two fictional demo companies — lets the company-selector UI be demoed without a DB */
const DEMO_TENANTS = [
  {
    id:          'demo-tenant-001',
    slug:        'demo',
    name:        'Empresa Demo SpA',
    logoUrl:     null,
    moduleCount: 15,
  },
  {
    id:          'demo-tenant-002',
    slug:        'holding-demo',
    name:        'Holding Consolidado SA',
    logoUrl:     null,
    moduleCount: 12,
  },
];

@Controller('auth')
export class DemoAuthController {
  constructor(private readonly jwtService: JwtService) {}

  @Public()
  @Post('login')
  login(@Body() body: { email?: string; password?: string }) {
    // SECURITY: This controller is only loaded when PG_HOST is not configured.
    // It must ONLY accept logins when DEMO_MODE is explicitly set to "true".
    // Without this check, a misconfigured production deployment (PG_HOST missing
    // but DEMO_MODE not set) would accept any credentials — a critical backdoor.
    if (process.env.DEMO_MODE !== 'true') {
      throw new UnauthorizedException(
        'El sistema no está configurado correctamente. ' +
        'Contacta al administrador (PG_HOST no configurado).'
      );
    }

    const email  = body.email ?? 'demo@informat.cl';
    const name   = email.split('@')[0]
      .replace(/\./g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const tenant = DEMO_TENANTS[0];

    const payload: JwtPayload = {
      sub:            'demo-user-id',
      email,
      role:           'admin',
      tenantId:       tenant.id,
      tenantSlug:     tenant.slug,
      tenantName:     tenant.name,
      allowedModules: ALL_MODULES,
    };

    return {
      access_token:      this.jwtService.sign(payload),
      user:              { ...payload, name, empresa: tenant.name, modules: ALL_MODULES },
      accessibleTenants: DEMO_TENANTS,
    };
  }

  @Get('me')
  me(@Req() req: any): JwtPayload {
    return req.user as JwtPayload;
  }

  /** Setup check — in demo mode setup is never required */
  @Public()
  @Get('setup-check')
  setupCheck() {
    return { needsSetup: false, demoMode: true };
  }

  /**
   * Switch tenant — demo version.
   * Returns a new JWT scoped to the requested demo company.
   */
  @Post('select-tenant')
  selectTenant(@Req() req: any, @Body() body: { tenantId?: string }) {
    const currentUser: JwtPayload = req.user;
    const tenant = DEMO_TENANTS.find((t) => t.id === body.tenantId) ?? DEMO_TENANTS[0];

    const payload: JwtPayload = {
      sub:            currentUser?.sub ?? 'demo-user-id',
      email:          currentUser?.email ?? 'demo@informat.cl',
      role:           'admin',
      tenantId:       tenant.id,
      tenantSlug:     tenant.slug,
      tenantName:     tenant.name,
      allowedModules: ALL_MODULES,
    };

    const name = (currentUser?.email ?? 'demo@informat.cl').split('@')[0]
      .replace(/\./g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      access_token:      this.jwtService.sign(payload),
      user:              { ...payload, name, empresa: tenant.name, modules: ALL_MODULES },
      accessibleTenants: DEMO_TENANTS,
    };
  }

  /**
   * Forgot password — demo mode stub.
   * Prints the reset URL to the server log (no SMTP needed).
   */
  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() body: { email?: string }) {
    const token    = 'demo-reset-token';
    const resetUrl = `${process.env.PORTAL_URL ?? 'http://localhost:3000'}/reset-password/${token}`;
    console.log(`[DEMO] Password reset URL for ${body.email ?? 'demo'}: ${resetUrl}`);
    return { ok: true };
  }

  /**
   * Reset password — demo mode stub.
   * Token "demo-reset-token" is always valid; any other token is rejected.
   */
  @Public()
  @Post('reset-password')
  resetPassword(@Body() body: { token?: string; password?: string }) {
    if (body.token !== 'demo-reset-token') {
      return { ok: false, message: 'Token inválido o expirado' };
    }
    console.log('[DEMO] Password reset applied (demo mode — no real DB change)');
    return { ok: true };
  }

  /** Validate reset token — demo mode */
  @Public()
  @Get('reset-password/validate')
  validateResetToken(@Query('token') token?: string) {
    return { valid: token === 'demo-reset-token' };
  }
}
