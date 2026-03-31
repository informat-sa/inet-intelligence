import {
  Controller, Post, Get, Body, Query, UnauthorizedException, Logger, NotFoundException,
} from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(1) password: string;
}

class AcceptInviteDto {
  @IsString() token: string;
  @IsString() @MinLength(2) name: string;
  @IsString() @MinLength(6) password: string;
}

class ForgotPasswordDto {
  @IsEmail() email: string;
}

class ResetPasswordDto {
  @IsString() token: string;
  @IsString() @MinLength(6) password: string;
}

class SelectTenantDto {
  @IsString() tenantId: string;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) throw new UnauthorizedException('Credenciales incorrectas');
    this.logger.log(`Login: ${dto.email} [${user.role}]`);
    return this.authService.login(user);
  }

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }

  @Public()
  @Post('invite/accept')
  async acceptInvite(@Body() dto: AcceptInviteDto) {
    const user = await this.usersService.acceptInvite(dto.token, dto.name, dto.password);
    if (!user) throw new UnauthorizedException('Token inválido o expirado');
    return this.authService.login(user);
  }

  /** Step 1: request a password-reset email */
  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  /** Step 2: apply new password using the reset token */
  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    try {
      return await this.authService.resetPassword(dto.token, dto.password);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new NotFoundException('El link de recuperación es inválido o ha expirado');
    }
  }

  /** Validate reset token without consuming it (used by the reset page to pre-check) */
  @Public()
  @Get('reset-password/validate')
  async validateResetToken(@Query('token') token: string) {
    if (!token) return { valid: false };
    const user = await this.usersService.findByResetToken(token);
    return { valid: !!user };
  }

  /**
   * Switch tenant context — re-issues a JWT scoped to the requested company.
   * The user must already have an authenticated JWT (not @Public).
   * Returns new access_token + full accessibleTenants list (so frontend
   * can re-render the company switcher without an extra round-trip).
   */
  @Post('select-tenant')
  async selectTenant(@CurrentUser() jwtUser: JwtPayload, @Body() dto: SelectTenantDto) {
    return this.authService.selectTenant(jwtUser, dto.tenantId);
  }
}
