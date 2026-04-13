import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { QueryService, StreamEvent } from './query.service';
import { SchemaService } from '../schema/schema.service';
import { DatabaseService } from '../database/database.service';
import { TenantsService } from '../tenants/tenants.service';
import { BcentralService } from '../bcentral/bcentral.service';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Collect all events emitted by streamQuery into an array. */
async function collect(
  gen: AsyncGenerator<StreamEvent>,
): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const ev of gen) events.push(ev);
  return events;
}

/** JWT payload used by most tests — full access, demo tenant */
const DEMO_JWT: JwtPayload = {
  sub: 'test-user-id',
  email: 'test@demo.cl',
  role: 'admin',
  tenantId: null,
  tenantSlug: 'demo',
  allowedModules: [], // empty = allow all
};

/** JWT with restricted module access */
const RESTRICTED_JWT: JwtPayload = {
  ...DEMO_JWT,
  allowedModules: ['VFA'], // only VFA allowed
};

// ─── DatabaseService mock ─────────────────────────────────────────────────────

const mockDb = {
  isConnected: jest.fn().mockReturnValue(false),
  executeQuery: jest.fn(),
  introspectModuleTables: jest.fn().mockResolvedValue([]),
};

// ─── SchemaService mock ───────────────────────────────────────────────────────

const mockSchema = {
  detectModules: jest.fn().mockReturnValue(['VFA']),
  getSchemaContext: jest.fn().mockReturnValue('-- schema context'),
  getRawStats: jest.fn().mockReturnValue({ tables: 5, columns: 20 }),
  estimateTokens: jest.fn().mockReturnValue(300),
  getAttributeTitle: jest.fn().mockReturnValue(null),
};

// ─── TenantsService mock ──────────────────────────────────────────────────────

const mockTenants = {
  findById: jest.fn().mockResolvedValue(null),
};

// ─── BcentralService mock ─────────────────────────────────────────────────────

const mockBcentral = {
  getResumenParaAI: jest.fn().mockReturnValue(null),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('QueryService', () => {
  let service: QueryService;

  beforeAll(() => {
    process.env.KB_DOCS_PATH = path.resolve(__dirname, '..', '..', 'docs');
  });

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    mockDb.isConnected.mockReturnValue(false);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryService,
        { provide: SchemaService, useValue: mockSchema },
        { provide: DatabaseService, useValue: mockDb },
        { provide: TenantsService, useValue: mockTenants },
        { provide: BcentralService, useValue: mockBcentral },
      ],
    }).compile();

    service = module.get<QueryService>(QueryService);
  });

  // ── DEMO_MODE — no Claude, no SQL ─────────────────────────────────────────

  describe('DEMO_MODE', () => {
    beforeEach(() => {
      process.env.DEMO_MODE = 'true';
      delete process.env.ANTHROPIC_API_KEY;
    });

    afterEach(() => {
      delete process.env.DEMO_MODE;
    });

    it('streams delta events in demo mode', async () => {
      const events = await collect(
        service.streamQuery('¿Cuánto vendimos?', DEMO_JWT),
      );
      const deltas = events.filter((e) => e.type === 'delta');
      expect(deltas.length).toBeGreaterThan(0);
    });

    it('emits a result event in demo mode', async () => {
      const events = await collect(
        service.streamQuery('¿Cuánto vendimos?', DEMO_JWT),
      );
      const results = events.filter((e) => e.type === 'result');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('emits a done event as the last event in demo mode', async () => {
      const events = await collect(
        service.streamQuery('¿Cuánto vendimos?', DEMO_JWT),
      );
      const last = events[events.length - 1];
      expect(last.type).toBe('done');
    });

    it('done event includes modulesUsed', async () => {
      const events = await collect(
        service.streamQuery('¿Cuánto vendimos?', DEMO_JWT),
      );
      const done = events.find((e) => e.type === 'done');
      expect(done).toBeDefined();
      expect(Array.isArray(done!.modulesUsed)).toBe(true);
    });

    it('done event includes suggestedFollowUps array', async () => {
      const events = await collect(
        service.streamQuery('¿Cuánto vendimos?', DEMO_JWT),
      );
      const done = events.find((e) => e.type === 'done');
      expect(Array.isArray(done!.suggestedFollowUps)).toBe(true);
    });

    it('never calls Claude (Anthropic SDK) in demo mode', async () => {
      // The Anthropic SDK is instantiated in the constructor with empty API key.
      // We verify no actual HTTP calls are made by checking DB is never called for schema.
      // Claude would call DB for live schema — in demo mode it should NOT.
      await collect(service.streamQuery('¿Cuánto vendimos?', DEMO_JWT));
      expect(mockDb.executeQuery).not.toHaveBeenCalled();
    });

    it('returns ventas scenario for "vendimos"', async () => {
      mockSchema.detectModules.mockReturnValue(['VFA']);
      const events = await collect(
        service.streamQuery('¿Cuánto vendimos este mes?', DEMO_JWT),
      );
      const result = events.find((e) => e.type === 'result');
      // Should yield a result (not an error)
      expect(result).toBeDefined();
      expect(result!.result?.type).not.toBe('error');
    });

    it('returns cobranzas scenario for "deuda"', async () => {
      mockSchema.detectModules.mockReturnValue(['CCC']);
      const events = await collect(
        service.streamQuery('¿Cuánto me deben los clientes?', DEMO_JWT),
      );
      const result = events.find((e) => e.type === 'result');
      expect(result).toBeDefined();
    });

    it('returns inventario scenario for "stock"', async () => {
      mockSchema.detectModules.mockReturnValue(['EXI']);
      const events = await collect(
        service.streamQuery('¿Qué productos tienen bajo stock?', DEMO_JWT),
      );
      const result = events.find((e) => e.type === 'result');
      expect(result).toBeDefined();
    });

    it('activates demo mode when ANTHROPIC_API_KEY is missing', async () => {
      delete process.env.DEMO_MODE;
      delete process.env.ANTHROPIC_API_KEY;
      const events = await collect(
        service.streamQuery('¿Cuánto vendimos?', DEMO_JWT),
      );
      // Should still stream (demo path, no crash)
      const done = events.find((e) => e.type === 'done');
      expect(done).toBeDefined();
    });

    it('activates demo mode when ANTHROPIC_API_KEY is the placeholder value', async () => {
      delete process.env.DEMO_MODE;
      process.env.ANTHROPIC_API_KEY = 'your_anthropic_api_key_here';
      const events = await collect(
        service.streamQuery('¿Cuánto vendimos?', DEMO_JWT),
      );
      const done = events.find((e) => e.type === 'done');
      expect(done).toBeDefined();
      delete process.env.ANTHROPIC_API_KEY;
    });

    it('emits no error events in demo mode', async () => {
      const events = await collect(
        service.streamQuery('¿Cuánto vendimos?', DEMO_JWT),
      );
      const errors = events.filter((e) => e.type === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  // ── Permission enforcement ─────────────────────────────────────────────────

  describe('module permission enforcement', () => {
    beforeEach(() => {
      process.env.DEMO_MODE = 'true';
    });
    afterEach(() => {
      delete process.env.DEMO_MODE;
    });

    it('blocks query when detected module is not in allowedModules', async () => {
      // User only has VFA, but question routes to REM
      mockSchema.detectModules.mockReturnValue(['REM']);
      const jwt: JwtPayload = { ...DEMO_JWT, allowedModules: ['VFA'] };

      const events = await collect(
        service.streamQuery('¿Cuántos empleados?', jwt),
      );
      const error = events.find((e) => e.type === 'error');
      expect(error).toBeDefined();
      expect(error!.error).toMatch(/permiso/i);
    });

    it('allows query when detected module is in allowedModules', async () => {
      mockSchema.detectModules.mockReturnValue(['VFA']);
      const events = await collect(
        service.streamQuery('¿Cuánto vendimos?', RESTRICTED_JWT),
      );
      const error = events.find((e) => e.type === 'error');
      expect(error).toBeUndefined();
    });

    it('allows query when allowedModules is empty (no restriction)', async () => {
      mockSchema.detectModules.mockReturnValue(['REM']);
      const jwt: JwtPayload = { ...DEMO_JWT, allowedModules: [] };
      const events = await collect(
        service.streamQuery('¿Cuántos empleados?', jwt),
      );
      // No permission error
      const error = events.find(
        (e) => e.type === 'error' && e.error?.match(/permiso/i),
      );
      expect(error).toBeUndefined();
    });

    it('allows ambiguous question (no modules detected) regardless of permissions', async () => {
      mockSchema.detectModules.mockReturnValue([]);
      const jwt: JwtPayload = { ...DEMO_JWT, allowedModules: ['VFA'] };
      const events = await collect(service.streamQuery('¿Cómo vamos?', jwt));
      const permError = events.find(
        (e) => e.type === 'error' && e.error?.match(/permiso/i),
      );
      expect(permError).toBeUndefined();
    });
  });

  // ── selectModel — model routing ───────────────────────────────────────────

  describe('selectModel() — model routing', () => {
    // Access private method via type cast
    function selectModel(q: string, n: number): string {
      return (service as any).selectModel(q, n);
    }

    const FAST = process.env.CLAUDE_MODEL_FAST ?? 'claude-haiku-4-5';
    const SMART = process.env.CLAUDE_MODEL_SMART ?? 'claude-sonnet-4-5';

    it('returns fast model for simple single-module query', () => {
      expect(selectModel('¿Cuántos clientes tenemos?', 1)).toBe(FAST);
    });

    it('returns fast model for single module + short question', () => {
      expect(selectModel('ventas del mes', 1)).toBe(FAST);
    });

    it('returns smart model when 3 or more modules', () => {
      expect(selectModel('resumen general', 3)).toBe(SMART);
    });

    it('returns smart model for "vs" comparison', () => {
      expect(selectModel('ventas este mes vs el anterior', 1)).toBe(SMART);
    });

    it('returns smart model for "versus"', () => {
      expect(selectModel('facturas versus notas de crédito', 1)).toBe(SMART);
    });

    it('returns smart model for "tendencia"', () => {
      expect(selectModel('tendencia de ventas últimos 6 meses', 1)).toBe(SMART);
    });

    it('returns smart model for "análisis"', () => {
      expect(selectModel('analiz las ventas del trimestre', 1)).toBe(SMART);
    });

    it('returns smart model for "crecimiento"', () => {
      expect(selectModel('crecimiento de ventas año a año', 1)).toBe(SMART);
    });

    it('returns smart model for "compara"', () => {
      expect(selectModel('compara los dos períodos', 1)).toBe(SMART);
    });

    it('returns smart model for "variación"', () => {
      expect(selectModel('variacion respecto al mes anterior', 1)).toBe(SMART);
    });

    it('returns smart model for "proyección"', () => {
      expect(selectModel('proyeccion de ventas para el año', 1)).toBe(SMART);
    });

    it('fast model for 2 modules (below threshold)', () => {
      expect(selectModel('facturas del mes', 2)).toBe(FAST);
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('emits error event when Claude throws (non-demo mode)', async () => {
      // Set a real-looking API key so demo mode is skipped
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-that-triggers-real-path';
      delete process.env.DEMO_MODE;

      mockDb.isConnected.mockReturnValue(false);

      // The Anthropic client will fail because the key is invalid / no network in tests.
      // QueryService catches the error and yields { type: 'error' }.
      const events = await collect(
        service.streamQuery('¿Cuánto vendimos?', DEMO_JWT),
      );
      const error = events.find((e) => e.type === 'error');
      expect(error).toBeDefined();
      expect(typeof error!.error).toBe('string');

      delete process.env.ANTHROPIC_API_KEY;
    });
  });

  // ── Stream shape contract ─────────────────────────────────────────────────

  describe('stream event shape contract', () => {
    beforeEach(() => {
      process.env.DEMO_MODE = 'true';
    });
    afterEach(() => {
      delete process.env.DEMO_MODE;
    });

    it('every delta event has a string delta field', async () => {
      const events = await collect(service.streamQuery('ventas', DEMO_JWT));
      for (const ev of events.filter((e) => e.type === 'delta')) {
        expect(typeof ev.delta).toBe('string');
      }
    });

    it('every result event has a result object with a type field', async () => {
      const events = await collect(service.streamQuery('ventas', DEMO_JWT));
      for (const ev of events.filter((e) => e.type === 'result')) {
        expect(ev.result).toBeDefined();
        expect(typeof ev.result!.type).toBe('string');
      }
    });

    it('exactly one done event per stream', async () => {
      const events = await collect(service.streamQuery('ventas', DEMO_JWT));
      expect(events.filter((e) => e.type === 'done')).toHaveLength(1);
    });
  });
});
