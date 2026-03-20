import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as sql from 'mssql';
import { decryptPassword } from '../common/crypto.util';

export interface TenantConnectionInfo {
  id: string;
  dbServer: string;
  dbPort: number;
  dbDatabase: string;
  dbUser: string;
  dbPasswordEncrypted: string;
  dbEncrypt: boolean;
  dbTrustCert: boolean;
}

export interface QueryExecutionResult {
  rows: Record<string, unknown>[];
  columns: Array<{ name: string; type: string }>;
  rowCount: number;
  executionMs: number;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  // Per-tenant pool registry (lazy creation)
  private readonly pools = new Map<string, sql.ConnectionPool>();

  // Demo/fallback pool (DEMO_MODE=true, uses env vars)
  private demoPool: sql.ConnectionPool | null = null;
  private demoConnected = false;

  async onModuleInit() {
    if (process.env.DEMO_MODE === 'true') {
      await this.connectDemoPool();
    }
  }

  async onModuleDestroy() {
    for (const pool of this.pools.values()) {
      await pool.close().catch(() => {});
    }
    await this.demoPool?.close().catch(() => {});
  }

  private async connectDemoPool(): Promise<void> {
    const server = process.env.DB_SERVER;
    const user   = process.env.DB_USER;
    const pass   = process.env.DB_PASSWORD;

    if (!server || !user || !pass) {
      this.logger.warn('Demo DB not configured — SQL queries will be skipped in demo mode');
      return;
    }

    try {
      this.demoPool = await sql.connect({
        server,
        database: process.env.DB_DATABASE ?? 'INET_STD',
        user,
        password: pass,
        port:     parseInt(process.env.DB_PORT ?? '1433'),
        options: {
          encrypt:                process.env.DB_ENCRYPT === 'true',
          trustServerCertificate: true,
          enableArithAbort:       true,
          connectTimeout:         30000,
        },
        pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
      });
      this.demoConnected = true;
      this.logger.log(`Demo DB connected: ${server}/${process.env.DB_DATABASE}`);
    } catch (err) {
      this.logger.error('Demo DB connection failed (will run without SQL)', err);
      this.demoConnected = false;
    }
  }

  /** Get or lazily create a dedicated pool for a tenant */
  async getPool(tenant: TenantConnectionInfo): Promise<sql.ConnectionPool> {
    const existing = this.pools.get(tenant.id);
    if (existing?.connected) return existing;

    if (existing) this.pools.delete(tenant.id); // stale — recreate

    const password = decryptPassword(tenant.dbPasswordEncrypted);
    const pool = await sql.connect({
      server:   tenant.dbServer,
      database: tenant.dbDatabase,
      user:     tenant.dbUser,
      password,
      port:     tenant.dbPort,
      options: {
        encrypt:                tenant.dbEncrypt,
        trustServerCertificate: tenant.dbTrustCert,
        enableArithAbort:       true,
        connectTimeout:         30000,
      },
      pool: { max: 5, min: 0, idleTimeoutMillis: 60000 },
    });
    this.pools.set(tenant.id, pool);
    this.logger.log(`Pool created for tenant [${tenant.id}]: ${tenant.dbServer}/${tenant.dbDatabase}`);
    return pool;
  }

  isConnected(tenantId?: string): boolean {
    if (!tenantId) return this.demoConnected && this.demoPool?.connected === true;
    return this.pools.get(tenantId)?.connected === true;
  }

  /** Execute a validated read-only query for a tenant (or demo pool if tenant=null) */
  async executeQuery(
    sqlText: string,
    tenant: TenantConnectionInfo | null,
    timeoutMs = 30000,
  ): Promise<QueryExecutionResult> {
    let pool: sql.ConnectionPool | null;

    if (tenant) {
      pool = await this.getPool(tenant);
    } else {
      pool = this.demoPool;
      if (!pool?.connected) {
        throw new Error('Base de datos demo no disponible');
      }
    }

    const start = Date.now();
    const request = (pool as sql.ConnectionPool).request();
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

    return { rows, columns, rowCount: rows.length, executionMs };
  }
}
