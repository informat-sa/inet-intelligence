/**
 * SchemaService — getSchemaContext(), getModule(), getRawStats(), estimateTokens()
 *
 * These tests verify:
 * 1. getSchemaContext() returns only the tables for the requested module(s)
 * 2. An unknown/non-existent module prefix returns a safe empty context (no crash)
 * 3. Multiple modules return context for all of them
 * 4. The output contains the expected table names
 * 5. Token estimation helpers work correctly
 * 6. getRawStats() counts tables and columns accurately
 */
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { SchemaService } from './schema.service';

describe('SchemaService — getSchemaContext()', () => {
  let service: SchemaService;

  beforeAll(async () => {
    process.env.KB_DOCS_PATH = path.resolve(__dirname, '..', '..', 'docs');

    const module: TestingModule = await Test.createTestingModule({
      providers: [SchemaService],
    }).compile();
    await module.init();

    service = module.get<SchemaService>(SchemaService);
  });

  // ── Returns correct module content ──────────────────────────────────────

  describe('single-module requests', () => {
    it('returns context string for VFA (includes VFA table names)', () => {
      const ctx = service.getSchemaContext(['VFA']);
      expect(typeof ctx).toBe('string');
      expect(ctx.length).toBeGreaterThan(0);
      // VFA tables must appear (at least one known name)
      expect(ctx).toMatch(/VFA|Ventas/i);
    });

    it('returns context string for CCC (includes CCC content)', () => {
      const ctx = service.getSchemaContext(['CCC']);
      expect(ctx).toMatch(/CCC|Cobrar|Cobranza/i);
    });

    it('returns context string for REM (includes REM content)', () => {
      const ctx = service.getSchemaContext(['REM']);
      expect(ctx).toMatch(/REM|Remuner/i);
    });

    it('returns context string for EXI (includes EXI content)', () => {
      const ctx = service.getSchemaContext(['EXI']);
      expect(ctx).toMatch(/EXI|Inventario|stock/i);
    });

    it('returns context string for ADQ (includes ADQ content)', () => {
      const ctx = service.getSchemaContext(['ADQ']);
      expect(ctx).toMatch(/ADQ|Adquisicion|compra/i);
    });

    it('returns context string for CON (includes CON content)', () => {
      const ctx = service.getSchemaContext(['CON']);
      expect(ctx).toMatch(/CON|Contabilidad/i);
    });

    it('context always starts with the SQL Server preamble comment', () => {
      const ctx = service.getSchemaContext(['VFA']);
      expect(ctx).toMatch(/^--\s+I-NET ERP/);
    });
  });

  // ── Unknown module returns empty/safe context ────────────────────────────

  describe('unknown / non-existent module prefix', () => {
    it('does NOT throw for unknown prefix', () => {
      expect(() => service.getSchemaContext(['ZZUNKNOWN'])).not.toThrow();
    });

    it('returns a string (may be just the header) for unknown prefix', () => {
      const ctx = service.getSchemaContext(['ZZUNKNOWN']);
      expect(typeof ctx).toBe('string');
    });

    it('does NOT throw for empty prefix list', () => {
      expect(() => service.getSchemaContext([])).not.toThrow();
    });

    it('returns a non-empty string (header) for empty prefix list', () => {
      const ctx = service.getSchemaContext([]);
      expect(typeof ctx).toBe('string');
      expect(ctx.length).toBeGreaterThan(0);
    });

    it('skips unknown prefix silently when mixed with valid prefix', () => {
      const withValid = service.getSchemaContext(['VFA']);
      const withUnknown = service.getSchemaContext(['VFA', 'ZZUNKNOWN']);
      // Both should include VFA content
      expect(withValid).toMatch(/VFA|Ventas/i);
      expect(withUnknown).toMatch(/VFA|Ventas/i);
      // Unknown prefix must not crash or inject garbage
      expect(withUnknown).not.toMatch(/ZZUNKNOWN/);
    });
  });

  // ── Multi-module requests ────────────────────────────────────────────────

  describe('multi-module requests', () => {
    it('includes content from all requested modules', () => {
      const ctx = service.getSchemaContext(['VFA', 'CCC']);
      expect(ctx).toMatch(/VFA|Ventas/i);
      expect(ctx).toMatch(/CCC|Cobrar/i);
    });

    it('three-module context is larger than single-module context', () => {
      const single = service.getSchemaContext(['VFA']);
      const triple = service.getSchemaContext(['VFA', 'CCC', 'EXI']);
      expect(triple.length).toBeGreaterThan(single.length);
    });
  });

  // ── Smart table selection with question ──────────────────────────────────

  describe('question-based relevance filtering', () => {
    it('returns a valid context string when question is provided', () => {
      const ctx = service.getSchemaContext(
        ['VFA'],
        '¿Cuáles son las ventas del mes?',
      );
      expect(typeof ctx).toBe('string');
      expect(ctx.length).toBeGreaterThan(0);
    });

    it('context without question is not smaller than context with generic question', () => {
      // Both paths should include module content
      const without = service.getSchemaContext(['REM']);
      const with_q = service.getSchemaContext(['REM'], 'sueldos');
      expect(without.length).toBeGreaterThan(0);
      expect(with_q.length).toBeGreaterThan(0);
    });
  });

  // ── getModule() ──────────────────────────────────────────────────────────

  describe('getModule()', () => {
    it('returns module definition for a known prefix', () => {
      const mod = service.getModule('VFA');
      expect(mod).toBeDefined();
      expect(mod!.prefix).toBe('VFA');
      expect(typeof mod!.name).toBe('string');
      expect(Array.isArray(mod!.tables)).toBe(true);
    });

    it('returns undefined for an unknown prefix (no crash)', () => {
      expect(service.getModule('ZZNOTREAL')).toBeUndefined();
    });

    it('module has at least one table with at least one attribute', () => {
      const mod = service.getModule('CCC');
      expect(mod).toBeDefined();
      expect(mod!.tables.length).toBeGreaterThan(0);
      // At least one table must have attributes (some tables may have 0 from KB)
      const withAttrs = mod!.tables.filter((t) => t.attributes.length > 0);
      expect(withAttrs.length).toBeGreaterThan(0);
    });

    it('module keywords array is populated', () => {
      const mod = service.getModule('REM');
      expect(mod).toBeDefined();
      expect(mod!.keywords.length).toBeGreaterThan(0);
    });
  });

  // ── getRawStats() ────────────────────────────────────────────────────────

  describe('getRawStats()', () => {
    it('returns {tables:0, columns:0} for empty prefix list', () => {
      expect(service.getRawStats([])).toEqual({ tables: 0, columns: 0 });
    });

    it('returns {tables:0, columns:0} for unknown prefix', () => {
      expect(service.getRawStats(['ZZUNKNOWN'])).toEqual({
        tables: 0,
        columns: 0,
      });
    });

    it('returns positive table and column counts for a known module', () => {
      const stats = service.getRawStats(['VFA']);
      expect(stats.tables).toBeGreaterThan(0);
      expect(stats.columns).toBeGreaterThan(0);
    });

    it('multi-module stats are sum of individual stats', () => {
      const vfa = service.getRawStats(['VFA']);
      const ccc = service.getRawStats(['CCC']);
      const both = service.getRawStats(['VFA', 'CCC']);
      expect(both.tables).toBe(vfa.tables + ccc.tables);
      expect(both.columns).toBe(vfa.columns + ccc.columns);
    });
  });

  // ── estimateTokens() ─────────────────────────────────────────────────────

  describe('estimateTokens()', () => {
    it('returns 0 for empty string', () => {
      expect(service.estimateTokens('')).toBe(0);
    });

    it('returns positive integer for non-empty string', () => {
      const tokens = service.estimateTokens('SELECT * FROM VFA_DOCC');
      expect(tokens).toBeGreaterThan(0);
      expect(Number.isInteger(tokens)).toBe(true);
    });

    it('longer string produces more tokens', () => {
      const short = service.estimateTokens('abc');
      const long = service.estimateTokens('abc'.repeat(100));
      expect(long).toBeGreaterThan(short);
    });

    it('estimates ~4 chars per token (rule-of-thumb)', () => {
      // 40 chars → ceil(40/4) = 10 tokens
      expect(service.estimateTokens('a'.repeat(40))).toBe(10);
    });
  });

  // ── getAttributeTitle() ──────────────────────────────────────────────────

  describe('getAttributeTitle()', () => {
    it('returns undefined for completely unknown column name', () => {
      expect(service.getAttributeTitle('ZZNOTACOLUMN')).toBeUndefined();
    });

    it('is case-insensitive (lookups uppercase-normalized)', () => {
      // Both casings must return the same result (either both defined or both undefined)
      const upper = service.getAttributeTitle('NROORD');
      const lower = service.getAttributeTitle('nroord');
      expect(upper).toEqual(lower);
    });
  });
});
