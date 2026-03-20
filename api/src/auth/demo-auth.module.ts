/**
 * Demo auth module — loaded instead of AuthModule when PostgreSQL is not configured.
 * Provides JWT signing/validation without any database dependency.
 */
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { DemoAuthController } from './demo-auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret:       config.get<string>('JWT_SECRET') ?? 'inet-intelligence-dev-secret',
        signOptions:  { expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '8h') as any },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [DemoAuthController],
  providers:   [JwtStrategy],
  exports:     [JwtModule, PassportModule],
})
export class DemoAuthModule {}
