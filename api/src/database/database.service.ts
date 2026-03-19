import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as sql from 'mssql';

export interface QueryExecutionResult {
  rows: Record<string, unknown>[];
  columns: Array<{ name: string; type: string }>;
  rowCount: number;
  executionMs: number;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: sql.ConnectionPool | null = null;
  private connected = false;

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.pool?.close();
  }

  private async connect() {
    const config: sql.config = {
      server:   process.env.DB_SERVER   ?? 'centauro',
      database: process.env.DB_DATABASE ?? 'INET_STD',
      user:     process.env.DB_USER     ?? '',
      password: process.env.DB_PASSWORD ?? '',
      port:     parseInt(process.env.DB_PORT ?? '1433'),
      options: {
        encrypt:                 process.env.DB_ENCRYPT === 'true',
        trustServerCertificate:  true,
        enableArithAbort:        true,
        connectTimeout:          30000,
      },
      pool: {
        max: 10, min: 0,
        idleTimeoutMillis: 30000,
      },
    };

    try {
      this.pool = await sql.connect(config);
      this.connected = true;
      this.logger.log(`Connected to SQL Server: ${config.server}/${config.database}`);
    } catch (err) {
      this.logger.error('Failed to connect to SQL Server', err);
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected && this.pool?.connected === true;
  }

  /** Execute a validated read-only query */
  async executeQuery(sqlText: string, timeoutMs = 30000): Promise<QueryExecutionResult> {
    if (!this.isConnected() || !this.pool) {
      throw new Error('Database not connected');
    }

    const start = Date.now();
    const request = this.pool.request();
    (request as any).timeout = timeoutMs;

    const result = await request.query(sqlText);
    const executionMs = Date.now() - start;

    const rows = result.recordset as Record<string, unknown>[];
    const columns = result.recordset.columns
      ? Object.entries(result.recordset.columns).map(([name, meta]: [string, any]) => ({
          name,
          type: meta?.type?.name ?? 'unknown',
        }))
      : rows.length > 0
      ? Object.keys(rows[0]).map((k) => ({ name: k, type: 'unknown' }))
      : [];

    return {
      rows,
      columns,
      rowCount: rows.length,
      executionMs,
    };
  }
}
