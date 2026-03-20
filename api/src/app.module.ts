/**
 * AppModule — multi-tenant I-NET Intelligence
 *
 * No PG_HOST configured  → DemoAuthModule only (no DB required)
 * PG_HOST configured     → full TypeORM + Auth + Users + Tenants + Favorites
 */
// Load .env before @Module() evaluates so process.env is populated for conditional imports
import * as dotenv from 'dotenv';
dotenv.config();

import { Module }                          from '@nestjs/common';
import { ConfigModule, ConfigService }     from '@nestjs/config';
import { TypeOrmModule }                   from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD }                       from '@nestjs/core';

import { DemoAuthModule }  from './auth/demo-auth.module';
import { AuthModule }      from './auth/auth.module';
import { UsersModule }     from './users/users.module';
import { TenantsModule }   from './tenants/tenants.module';
import { FavoritesModule } from './favorites/favorites.module';
import { MailModule }      from './mail/mail.module';
import { JwtAuthGuard }    from './auth/guards/jwt-auth.guard';

import { SchemaService }    from './schema/schema.service';
import { SchemaController } from './schema/schema.controller';
import { DatabaseService }  from './database/database.service';
import { QueryService }     from './query/query.service';
import { QueryController }  from './query/query.controller';
import { HealthController } from './health/health.controller';

import { Tenant }               from './tenants/entities/tenant.entity';
import { User }                 from './users/entities/user.entity';
import { UserModulePermission } from './users/entities/user-module-permission.entity';
import { UserTenantAccess }     from './users/entities/user-tenant-access.entity';
import { Favorite }             from './favorites/entities/favorite.entity';

// ── Decide whether to use PostgreSQL ────────────────────────────────────────
// dotenv.config() was called above so process.env has values from .env file
const HAS_PG = !!(process.env.PG_HOST ?? '').trim();

const pgImports = HAS_PG
  ? [
      TypeOrmModule.forRootAsync({
        imports:    [ConfigModule],
        useFactory: (config: ConfigService) => ({
          type:        'postgres',
          host:        config.get<string>('PG_HOST')     ?? 'localhost',
          port:        config.get<number>('PG_PORT')     ?? 5432,
          database:    config.get<string>('PG_DATABASE') ?? 'inet_intelligence',
          username:    config.get<string>('PG_USER')     ?? 'postgres',
          password:    config.get<string>('PG_PASSWORD') ?? '',
          entities:    [Tenant, User, UserModulePermission, UserTenantAccess, Favorite],
          synchronize: config.get<string>('NODE_ENV') !== 'production',
          ssl:         config.get<string>('PG_SSL') === 'true'
                         ? { rejectUnauthorized: false }
                         : false,
          logging:     config.get<string>('NODE_ENV') === 'development' ? ['error'] : false,
        }),
        inject: [ConfigService],
      }),
      MailModule,
      TenantsModule,
      UsersModule,
      AuthModule,
      FavoritesModule,
    ]
  : [
      // No PostgreSQL configured — demo mode uses in-memory JWT auth only
      DemoAuthModule,
    ];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 30 }]),
    ...pgImports,
  ],
  controllers: [QueryController, SchemaController, HealthController],
  providers: [
    SchemaService,
    DatabaseService,
    QueryService,
    // Global JWT guard — @Public() routes bypass it
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Global rate limiter
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
