import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

// Demo payload returned when DEMO_MODE=true
const DEMO_PAYLOAD: JwtPayload = {
  sub: 'demo-user-id',
  email: 'demo@informat.cl',
  role: 'admin',
  tenantId: null,
  tenantSlug: 'demo',
  tenantName: 'Empresa Demo SpA',
  allowedModules: ['VFA','CCC','ADQ','IMP','EXI','PRO','AFF','REM','CON','SII','PAR','DDI','FIN','GAN','ATE'],
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'inet-dev-only-secret-not-for-production',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // In demo mode, accept the demo_token payload directly
    if (process.env.DEMO_MODE === 'true') {
      return payload ?? DEMO_PAYLOAD;
    }
    if (!payload?.sub) throw new UnauthorizedException('Token inválido');
    return payload;
  }
}
