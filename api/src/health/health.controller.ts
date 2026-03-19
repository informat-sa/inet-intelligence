import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: this.db.isConnected(),
      llm: !!process.env.ANTHROPIC_API_KEY,
      version: '1.0.0',
    };
  }
}
