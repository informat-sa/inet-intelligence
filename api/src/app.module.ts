import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { SchemaService } from './schema/schema.service';
import { DatabaseService } from './database/database.service';
import { QueryService } from './query/query.service';
import { QueryController } from './query/query.controller';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      name:  'default',
      ttl:   60_000,   // 1 minute window
      limit: 30,       // 30 queries / user / minute
    }]),
  ],
  controllers: [QueryController, HealthController],
  providers: [
    SchemaService,
    DatabaseService,
    QueryService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
