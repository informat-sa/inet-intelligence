import {
  Controller, Get, Post, Put, Delete, Param, Body,
  UseGuards, ForbiddenException, Logger,
} from '@nestjs/common';
import { IsEmail, IsString, IsArray, IsOptional, MinLength } from 'class-validator';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import { MailService } from '../mail/mail.service';
import { TenantsService } from '../tenants/tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

const MODULE_NAMES: Record<string, string> = {
  VFA: 'Ventas y Facturación', CCC: 'Cuentas por Cobrar',
  ADQ: 'Adquisiciones', IMP: 'Importaciones',
  EXI: 'Existencias', PRO: 'Productos',
  AFF: 'Activo Fijo', REM: 'Remuneraciones',
  CON: 'Contabilidad', SII: 'SII / Tributario',
  PAR: 'Parámetros', DDI: 'Despacho',
  FIN: 'Finanzas', GAN: 'Granos', ATE: 'Atención Clientes',
};

class InviteUserDto {
  @IsEmail() email: string;
  @IsString() @MinLength(2) name: string;
  @IsArray() @IsString({ each: true }) modulePermissions: string[];
}

class SetPermissionsDto {
  @IsArray() @IsString({ each: true }) modules: string[];
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly mailService: MailService,
    private readonly tenantsService: TenantsService,
  ) {}

  @Roles('admin', 'super_admin')
  @Get()
  async list(@CurrentUser() me: JwtPayload) {
    if (!me.tenantId) return [];
    const users = await this.usersService.findByTenant(me.tenantId);
    return users.map((u) => ({
      id:          u.id,
      name:        u.name,
      email:       u.email,
      role:        u.role,
      isActive:    u.isActive,
      lastLoginAt: u.lastLoginAt,
      isPending:   !u.isActive && !!u.inviteToken,
      modules:     u.modulePermissions.filter(p => p.enabled).map(p => p.modulePrefix),
    }));
  }

  @Roles('admin', 'super_admin')
  @Get(':id/permissions')
  async getPermissions(@Param('id') id: string, @CurrentUser() me: JwtPayload) {
    const user = await this.usersService.findById(id);
    if (!user || user.tenantId !== me.tenantId) throw new ForbiddenException();
    return user.modulePermissions.map((p) => ({
      modulePrefix: p.modulePrefix,
      moduleName:   MODULE_NAMES[p.modulePrefix] ?? p.modulePrefix,
      enabled:      p.enabled,
    }));
  }

  @Roles('admin', 'super_admin')
  @Put(':id/permissions')
  async setPermissions(
    @Param('id') id: string,
    @Body() dto: SetPermissionsDto,
    @CurrentUser() me: JwtPayload,
  ) {
    const user = await this.usersService.findById(id);
    if (!user || user.tenantId !== me.tenantId) throw new ForbiddenException();
    await this.usersService.setPermissions(id, dto.modules);
    return { success: true };
  }

  @Roles('admin', 'super_admin')
  @Delete(':id')
  async deactivate(@Param('id') id: string, @CurrentUser() me: JwtPayload) {
    const user = await this.usersService.findById(id);
    if (!user || user.tenantId !== me.tenantId) throw new ForbiddenException();
    await this.usersService.setActive(id, false);
    return { success: true };
  }

  @Roles('admin', 'super_admin')
  @Post('invite')
  async invite(@Body() dto: InviteUserDto, @CurrentUser() me: JwtPayload) {
    if (!me.tenantId) throw new ForbiddenException('Solo admins de empresa pueden invitar usuarios');

    const newUser = await this.usersService.createInvite({
      email:             dto.email,
      name:              dto.name,
      tenantId:          me.tenantId,
      invitedByUserId:   me.sub,
      modulePermissions: dto.modulePermissions,
    });

    // Get tenant info for email
    const tenant = await this.tenantsService.findById(me.tenantId);
    const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';
    const inviteUrl = `${webUrl}/invite/${newUser.inviteToken}`;
    const modulesList = dto.modulePermissions
      .map((p) => MODULE_NAMES[p] ?? p)
      .join(', ');

    await this.mailService.sendInviteEmail({
      to:          dto.email,
      toName:      dto.name,
      adminName:   me.tenantName ?? 'El administrador',
      tenantName:  tenant?.name ?? 'su empresa',
      modulesList,
      inviteUrl,
    });

    this.logger.log(`User invited: ${dto.email} by ${me.email}`);
    return { success: true, userId: newUser.id };
  }

  @Roles('admin', 'super_admin')
  @Post(':id/resend-invite')
  async resendInvite(@Param('id') id: string, @CurrentUser() me: JwtPayload) {
    const user = await this.usersService.findById(id);
    if (!user || user.tenantId !== me.tenantId) throw new ForbiddenException();
    const updated = await this.usersService.resendInvite(id);
    const tenant = await this.tenantsService.findById(me.tenantId!);
    const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';
    const inviteUrl = `${webUrl}/invite/${updated.inviteToken}`;
    await this.mailService.sendInviteEmail({
      to:          user.email,
      toName:      user.name,
      adminName:   me.tenantName ?? 'El administrador',
      tenantName:  tenant?.name ?? 'su empresa',
      modulesList: user.modulePermissions.map(p => MODULE_NAMES[p.modulePrefix] ?? p.modulePrefix).join(', '),
      inviteUrl,
    });
    return { success: true };
  }
}
