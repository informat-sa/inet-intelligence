/**
 * DatabaseService unit tests
 *
 * Strategy: mock `mssql` and `decryptPassword` at module level so no real
 * SQL Server connection is ever attempted.  The private `demoPool` field is
 * accessed via type cast when we need to simulate a connected/disconnected state.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService, TenantConnectionInfo } from './database.service';

// ─── mssql mock ───────────────────────────────────────────────────────────────

/** Shared mock objects – reset before each test */
const mockRequest = {
  timeout: undefined as number | undefined,
  query: jest.fn(),
};

const mockPool = {
  connected: true,
  request: jest.fn().mockReturnValue(mockRequest),
  close: jest.fn().mockResolvedValue(undefined),
};

jest.mock('mssql', () => ({
  connect: jest.fn(),
}));

// ─── crypto.util mock ─────────────────────────────────────────────────────────

jest.mock('../common/crypto.util', () => ({
  decryptPassword: jest.fn().mockReturnValue('plaintext-password'),
}));

// ─── helpers ──────────────────────────────────────────────────────────────────

import * as sql from 'mssql';

const sqlConnectMock = sql.connect as jest.MockedFunction<typeof sql.connect>;

function makeTenant(
  overrides?: Partial<TenantConnectionInfo>,
): TenantConnectionInfo {
  return {
    id: 'tenant-1',
    dbServer: 'sql.example.cl',
    dbPort: 1433,
    dbDatabase: 'INET_STD',
    dbUser: 'sa',
    dbPasswordEncrypted: 'enc:password',
    dbEncrypt: false,
    dbTrustCert: true,
    ...overrides,
  };
}

/** Build a minimal mssql recordset (rows + columns metadata). */
function makeRecordset(rows: Record<string, unknown>[]) {
  const rs: any = [...rows];
  rs.columns =
    rows.length > 0
      ? Object.fromEntries(
          Object.keys(rows[0]).map((k) => [k, { type: { name: 'NVarChar' } }]),
        )
      : {};
  return rs;
}

// ─── suite ────────────────────────────────────────────────────────────────────

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default: pool is connected; connect() returns a usable pool
    mockPool.connected = true;
    mockPool.request.mockReturnValue(mockRequest);
    sqlConnectMock.mockResolvedValue(mockPool as any);

    // Ensure no stray DEMO_MODE leaks between tests
    delete process.env.DEMO_MODE;
    delete process.env.DB_SERVER;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;

    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabaseService],
    }).compile();

    // Do NOT call module.init() — avoids real sql.connect in onModuleInit.
    // We inject pool state directly where needed.
    service = module.get<DatabaseService>(DatabaseService);
  });

  // ── isConnected ───────────────────────────────────────────────────────────

  describe('isConnected()', () => {
    it('returns false when demoPool is null (default)', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('returns false when demoPool exists but connected=false', () => {
      (service as any).demoPool = { connected: false };
      (service as any).demoConnected = false;
      expect(service.isConnected()).toBe(false);
    });

    it('returns true when demoPool is connected', () => {
      (service as any).demoPool = { connected: true };
      (service as any).demoConnected = true;
      expect(service.isConnected()).toBe(true);
    });

    it('returns false for unknown tenantId', () => {
      expect(service.isConnected('unknown-tenant')).toBe(false);
    });

    it('returns true for tenantId that has a connected pool', () => {
      (service as any).pools.set('t1', { connected: true });
      expect(service.isConnected('t1')).toBe(true);
    });

    it('returns false for tenantId whose pool is disconnected', () => {
      (service as any).pools.set('t1', { connected: false });
      expect(service.isConnected('t1')).toBe(false);
    });
  });

  // ── executeQuery — demo pool ─────────────────────────────────────────────

  describe('executeQuery() — demo pool (tenant=null)', () => {
    beforeEach(() => {
      // Inject a connected demo pool
      (service as any).demoPool = mockPool;
      (service as any).demoConnected = true;
    });

    it('throws when demo pool is null', async () => {
      (service as any).demoPool = null;
      await expect(service.executeQuery('SELECT 1', null)).rejects.toThrow(
        'Base de datos demo no disponible',
      );
    });

    it('throws when demo pool is disconnected', async () => {
      (service as any).demoPool = { ...mockPool, connected: false };
      await expect(service.executeQuery('SELECT 1', null)).rejects.toThrow(
        'Base de datos demo no disponible',
      );
    });

    it('returns rows when query succeeds', async () => {
      const rows = [{ id: 1, name: 'Test' }];
      mockRequest.query.mockResolvedValueOnce({
        recordset: makeRecordset(rows),
      });

      const result = await service.executeQuery('SELECT * FROM T', null);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({ id: 1, name: 'Test' });
      expect(result.rowCount).toBe(1);
    });

    it('returns empty rows array for 0-result query', async () => {
      mockRequest.query.mockResolvedValueOnce({ recordset: makeRecordset([]) });

      const result = await service.executeQuery(
        'SELECT * FROM T WHERE 1=0',
        null,
      );

      expect(result.rows).toHaveLength(0);
      expect(result.rowCount).toBe(0);
      expect(Array.isArray(result.columns)).toBe(true);
    });

    it('maps column metadata from recordset.columns', async () => {
      const rows = [{ NroOrd: 1, MonVta: 1000.5 }];
      const recordset = makeRecordset(rows);
      recordset.columns = {
        NroOrd: { type: { name: 'Int' } },
        MonVta: { type: { name: 'Money' } },
      };
      mockRequest.query.mockResolvedValueOnce({ recordset });

      const result = await service.executeQuery(
        'SELECT NroOrd, MonVta FROM VFA_DOCC',
        null,
      );

      expect(result.columns).toEqual([
        { name: 'NroOrd', type: 'Int' },
        { name: 'MonVta', type: 'Money' },
      ]);
    });

    it('falls back to row keys for columns when recordset.columns is absent', async () => {
      const rows = [{ A: 1, B: 2 }];
      const recordset: any = [...rows];
      // No .columns property
      mockRequest.query.mockResolvedValueOnce({ recordset });

      const result = await service.executeQuery('SELECT A, B FROM T', null);

      expect(result.columns.map((c) => c.name)).toEqual(['A', 'B']);
    });

    it('includes executionMs in result', async () => {
      mockRequest.query.mockResolvedValueOnce({
        recordset: makeRecordset([{ x: 1 }]),
      });
      const result = await service.executeQuery('SELECT 1', null);
      expect(typeof result.executionMs).toBe('number');
      expect(result.executionMs).toBeGreaterThanOrEqual(0);
    });

    it('sets request.timeout from the timeoutMs parameter', async () => {
      mockRequest.query.mockResolvedValueOnce({ recordset: makeRecordset([]) });
      await service.executeQuery('SELECT 1', null, 5000);
      expect(mockRequest.timeout).toBe(5000);
    });

    it('uses default timeout of 30000ms when not specified', async () => {
      mockRequest.query.mockResolvedValueOnce({ recordset: makeRecordset([]) });
      await service.executeQuery('SELECT 1', null);
      expect(mockRequest.timeout).toBe(30000);
    });

    it('propagates SQL Server errors (does not swallow)', async () => {
      const dbError = new Error('Invalid object name VFA_DOCC');
      mockRequest.query.mockRejectedValueOnce(dbError);

      await expect(
        service.executeQuery('SELECT * FROM VFA_DOCC', null),
      ).rejects.toThrow('Invalid object name VFA_DOCC');
    });

    it('propagates timeout errors from mssql', async () => {
      const timeoutError = Object.assign(new Error('Request timed out'), {
        code: 'ETIMEOUT',
      });
      mockRequest.query.mockRejectedValueOnce(timeoutError);

      await expect(
        service.executeQuery(
          'SELECT * FROM INFORMAT_Vista_DocumentosComerciales',
          null,
          15000,
        ),
      ).rejects.toMatchObject({ code: 'ETIMEOUT' });
    });

    it('returns multiple rows correctly', async () => {
      const rows = [
        { CliCod: '1', Nombre: 'Empresa A', Deuda: 1000 },
        { CliCod: '2', Nombre: 'Empresa B', Deuda: 2000 },
        { CliCod: '3', Nombre: 'Empresa C', Deuda: 3000 },
      ];
      mockRequest.query.mockResolvedValueOnce({
        recordset: makeRecordset(rows),
      });

      const result = await service.executeQuery(
        'SELECT TOP 3 CliCod, Nombre, Deuda FROM CCCONCLI',
        null,
      );

      expect(result.rows).toHaveLength(3);
      expect(result.rowCount).toBe(3);
    });
  });

  // ── executeQuery — per-tenant pool ────────────────────────────────────────

  describe('executeQuery() — tenant pool', () => {
    const tenant = makeTenant();

    beforeEach(() => {
      sqlConnectMock.mockResolvedValue(mockPool as any);
    });

    it('calls sql.connect to create a pool for a new tenant', async () => {
      mockRequest.query.mockResolvedValueOnce({ recordset: makeRecordset([]) });
      await service.executeQuery('SELECT 1', tenant);
      expect(sqlConnectMock).toHaveBeenCalledTimes(1);
    });

    it('reuses the existing pool on second call (no duplicate connect)', async () => {
      mockRequest.query.mockResolvedValue({ recordset: makeRecordset([]) });
      await service.executeQuery('SELECT 1', tenant);
      await service.executeQuery('SELECT 2', tenant);
      expect(sqlConnectMock).toHaveBeenCalledTimes(1); // created once, reused
    });

    it('passes decrypted password to sql.connect', async () => {
      const { decryptPassword } = require('../common/crypto.util');
      (decryptPassword as jest.Mock).mockReturnValueOnce('decrypted-pass');

      mockRequest.query.mockResolvedValueOnce({ recordset: makeRecordset([]) });
      await service.executeQuery('SELECT 1', tenant);

      const connectArgs = sqlConnectMock.mock.calls[0][0] as any;
      expect(connectArgs.password).toBe('decrypted-pass');
    });

    it('propagates error when sql.connect fails', async () => {
      sqlConnectMock.mockRejectedValueOnce(
        new Error('Cannot connect to SQL Server'),
      );
      await expect(service.executeQuery('SELECT 1', tenant)).rejects.toThrow(
        'Cannot connect to SQL Server',
      );
    });
  });

  // ── getPool — reconnect on stale pool ────────────────────────────────────

  describe('getPool() — stale pool reconnection', () => {
    const tenant = makeTenant();

    it('closes and recreates a stale (disconnected) pool', async () => {
      const stalePool = {
        connected: false,
        close: jest.fn().mockResolvedValue(undefined),
        request: jest.fn(),
      };
      (service as any).pools.set(tenant.id, stalePool);
      (service as any).poolsLRU.set(tenant.id, Date.now());

      sqlConnectMock.mockResolvedValue(mockPool as any);

      await service.getPool(tenant);

      expect(stalePool.close).toHaveBeenCalledTimes(1); // old pool closed
      expect(sqlConnectMock).toHaveBeenCalledTimes(1); // new pool created
    });
  });

  // ── getPool — connection timeout ─────────────────────────────────────────

  describe('getPool() — connection timeout', () => {
    it('rejects after 20 seconds when SQL Server never responds', async () => {
      jest.useFakeTimers();

      // sql.connect() that never resolves (simulates unresponsive server)
      sqlConnectMock.mockReturnValueOnce(new Promise(() => {}));

      const tenant = makeTenant({ id: 'timeout-tenant' });
      const promise = service.getPool(tenant);

      // Advance past the 20s internal timeout
      jest.advanceTimersByTime(21_000);

      await expect(promise).rejects.toThrow(/timeout/i);

      jest.useRealTimers();
    });
  });

  // ── getPool — LRU eviction ────────────────────────────────────────────────

  describe('getPool() — LRU eviction at MAX_TENANT_POOLS=20', () => {
    it('evicts the least-recently-used pool when cap is reached', async () => {
      const MAX = 20;
      const closedPools: jest.Mock[] = [];

      // Fill to MAX_TENANT_POOLS with pools that have recent LRU timestamps
      for (let i = 0; i < MAX; i++) {
        const closeFn = jest.fn().mockResolvedValue(undefined);
        closedPools.push(closeFn);
        const p = { connected: true, close: closeFn, request: jest.fn() };
        (service as any).pools.set(`t${i}`, p);
        // Stagger timestamps so t0 is the oldest (LRU)
        (service as any).poolsLRU.set(`t${i}`, i * 100);
      }

      sqlConnectMock.mockResolvedValue(mockPool as any);

      // Request a brand-new tenant pool to trigger eviction
      await service.getPool(makeTenant({ id: 'new-tenant' }));

      // t0 (oldest) must have been closed
      expect(closedPools[0]).toHaveBeenCalledTimes(1);
      // All others must be untouched
      for (let i = 1; i < MAX; i++) {
        expect(closedPools[i]).not.toHaveBeenCalled();
      }
    });
  });

  // ── introspectModuleTables ────────────────────────────────────────────────

  describe('introspectModuleTables()', () => {
    it('returns empty array immediately when prefixes list is empty', async () => {
      const result = await service.introspectModuleTables(null, []);
      expect(result).toEqual([]);
      // Should not call executeQuery at all
      expect(mockRequest.query).not.toHaveBeenCalled();
    });

    it('executes INFORMATION_SCHEMA query for given prefixes', async () => {
      const rows = [
        {
          TABLE_NAME: 'VFA_DOCC',
          COLUMN_NAME: 'NroOrd',
          DATA_TYPE: 'numeric',
          CHARACTER_MAXIMUM_LENGTH: null,
          NUMERIC_PRECISION: 10,
          NUMERIC_SCALE: 0,
        },
      ];
      (service as any).demoPool = mockPool;
      (service as any).demoConnected = true;
      mockRequest.query.mockResolvedValueOnce({
        recordset: makeRecordset(rows),
      });

      const result = await service.introspectModuleTables(null, ['VFA']);

      expect(mockRequest.query).toHaveBeenCalledTimes(1);
      const sqlArg: string = mockRequest.query.mock.calls[0][0];
      expect(sqlArg).toMatch(/INFORMATION_SCHEMA\.COLUMNS/);
      expect(sqlArg).toMatch(/VFA%/);
      expect(result).toHaveLength(rows.length);
      expect(result[0]).toMatchObject(rows[0]);
    });

    it('includes a LIKE filter per prefix', async () => {
      (service as any).demoPool = mockPool;
      (service as any).demoConnected = true;
      mockRequest.query.mockResolvedValueOnce({ recordset: makeRecordset([]) });

      await service.introspectModuleTables(null, ['VFA', 'CCC', 'EXI']);

      const sqlArg: string = mockRequest.query.mock.calls[0][0];
      expect(sqlArg).toMatch(/VFA%/);
      expect(sqlArg).toMatch(/CCC%/);
      expect(sqlArg).toMatch(/EXI%/);
    });
  });
});
