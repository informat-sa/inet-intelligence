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

// Hard limit: prevents 100 tenants × 5 connections = 500 simultaneous SQL Server connections.
// When the limit is reached, the least-recently-used pool is closed and evicted.
const MAX_TENANT_POOLS = 20;

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  // Per-tenant pool registry (lazy creation, LRU-bounded to MAX_TENANT_POOLS)
  private readonly pools    = new Map<string, sql.ConnectionPool>();
  private readonly poolsLRU = new Map<string, number>(); // tenantId → last access epoch ms

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

  /** Get or lazily create a dedicated pool for a tenant (LRU-bounded) */
  async getPool(tenant: TenantConnectionInfo): Promise<sql.ConnectionPool> {
    const existing = this.pools.get(tenant.id);
    if (existing?.connected) {
      this.poolsLRU.set(tenant.id, Date.now()); // refresh LRU timestamp
      return existing;
    }

    if (existing) {
      // Stale pool — close it before recreating
      this.pools.delete(tenant.id);
      this.poolsLRU.delete(tenant.id);
      await existing.close().catch(() => {});
    }

    // Enforce pool cap: evict the least-recently-used pool if at limit
    if (this.pools.size >= MAX_TENANT_POOLS) {
      const lruEntry = [...this.poolsLRU.entries()].sort((a, b) => a[1] - b[1])[0];
      if (lruEntry) {
        const [evictId] = lruEntry;
        const evictPool = this.pools.get(evictId);
        this.pools.delete(evictId);
        this.poolsLRU.delete(evictId);
        await evictPool?.close().catch(() => {});
        this.logger.warn(`Pool evicted (LRU cap=${MAX_TENANT_POOLS}) for tenant [${evictId}]`);
      }
    }

    const password = decryptPassword(tenant.dbPasswordEncrypted);

    // Wrap sql.connect() with an AbortSignal-style timeout so a non-responding
    // SQL Server never hangs the request indefinitely.
    const connectPromise = sql.connect({
      server:   tenant.dbServer,
      database: tenant.dbDatabase,
      user:     tenant.dbUser,
      password,
      port:     tenant.dbPort,
      options: {
        encrypt:                tenant.dbEncrypt,
        trustServerCertificate: tenant.dbTrustCert,
        enableArithAbort:       true,
        connectTimeout:         15000,   // 15s to establish connection
      },
      pool: { max: 5, min: 0, idleTimeoutMillis: 60000 },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Connection timeout for tenant [${tenant.id}] — SQL Server not responding`)), 20000)
    );

    const pool = await Promise.race([connectPromise, timeoutPromise]);
    this.pools.set(tenant.id, pool);
    this.poolsLRU.set(tenant.id, Date.now());
    this.logger.log(`Pool created for tenant [${tenant.id}]: ${tenant.dbServer}/${tenant.dbDatabase} (pools active: ${this.pools.size})`);
    return pool;
  }

  isConnected(tenantId?: string): boolean {
    if (!tenantId) return this.demoConnected && this.demoPool?.connected === true;
    return this.pools.get(tenantId)?.connected === true;
  }

  /**
   * Query INFORMATION_SCHEMA.COLUMNS filtered by table name prefixes.
   * Used to build live schema context for Claude instead of relying on JSON files.
   */
  async introspectModuleTables(
    tenant: TenantConnectionInfo | null,
    prefixes: string[],
  ): Promise<Record<string, unknown>[]> {
    if (prefixes.length === 0) return [];
    // prefixes are validated upstream to be [A-Z]{2,5} only — no injection risk
    const likeFilters = prefixes.map((p) => `TABLE_NAME LIKE '${p}%'`).join(' OR ');
    const sqlText = `
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE,
             CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND (${likeFilters})
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `;
    const result = await this.executeQuery(sqlText, tenant, 15000);
    return result.rows;
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
