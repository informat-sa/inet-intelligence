import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { SchemaService } from './schema.service';

/**
 * Unit tests for SchemaService.detectModules()
 *
 * detectModules() must:
 * - Return the correct module prefix(es) for Spanish-language business questions
 * - Handle accent normalization (ventas vs ventás, facturación vs facturacion)
 * - Return empty array for ambiguous / off-topic questions
 * - Return up to 3 modules when multiple are relevant
 * - Score longer keyword phrases higher than single-word keywords
 */
describe('SchemaService — detectModules()', () => {
  let service: SchemaService;

  beforeAll(async () => {
    // Point to the real KB docs so onModuleInit loads the schema correctly.
    // In production the service resolves relative to dist/schema (3 levels up = api/docs).
    // In tests ts-jest keeps __dirname pointing at src/schema, so we must set the
    // absolute path explicitly — api/docs is one level up from src/.
    process.env.KB_DOCS_PATH = path.resolve(__dirname, '..', '..', 'docs');

    const module: TestingModule = await Test.createTestingModule({
      providers: [SchemaService],
    }).compile();

    // .init() triggers OnModuleInit → loadSchema() reads KB files
    await module.init();

    service = module.get<SchemaService>(SchemaService);
  });

  // ── VFA — Ventas y Facturación ─────────────────────────────────────────────

  describe('VFA — Ventas y Facturación', () => {
    const vfaQuestions = [
      '¿Cuánto vendimos este mes?',
      '¿Cuáles son las ventas del trimestre?',
      '¿Qué facturas están pendientes?',
      'Muéstrame las boletas de ayer',
      '¿Cuál es el ingreso neto de enero?',
      '¿Qué clientes compraron esta semana?',
      'Lista los precios de los artículos',
      '¿Cuántos documentos emitimos hoy?',
      'Ventas de este año vs el anterior',
      '¿Qué descuentos se aplicaron este mes?',
    ];

    test.each(vfaQuestions)('detects VFA: "%s"', (q) => {
      expect(service.detectModules(q)).toContain('VFA');
    });
  });

  // ── CCC — Cuentas por Cobrar ───────────────────────────────────────────────

  describe('CCC — Cuentas por Cobrar', () => {
    const cccQuestions = [
      '¿Cuánto me deben los clientes?',
      'Lista los clientes morosos',
      '¿Qué facturas tienen deuda vencida?',
      '¿Cuál es la cartera de cobranza?',
      '¿Qué clientes tienen pagos pendientes?',
      'Documentos con vencimiento esta semana',
    ];

    test.each(cccQuestions)('detects CCC: "%s"', (q) => {
      expect(service.detectModules(q)).toContain('CCC');
    });
  });

  // ── EXI — Existencias e Inventario ────────────────────────────────────────

  describe('EXI — Existencias e Inventario', () => {
    const exiQuestions = [
      '¿Qué productos tienen bajo stock?',
      '¿Cuál es el inventario actual?',
      '¿Cuántas unidades hay en bodega?',
      'Artículos sin movimiento en 90 días',
      '¿Cuál es el saldo de existencias?',
    ];

    test.each(exiQuestions)('detects EXI: "%s"', (q) => {
      expect(service.detectModules(q)).toContain('EXI');
    });
  });

  // ── ADQ — Adquisiciones y Compras ─────────────────────────────────────────

  describe('ADQ — Adquisiciones y Compras', () => {
    const adqQuestions = [
      '¿Cuánto gastamos en compras este mes?',
      'Lista las órdenes de compra pendientes',
      '¿Qué proveedores facturaron más?',
      'Cotizaciones recibidas esta semana',
      'Recepciones de mercadería del mes',
    ];

    test.each(adqQuestions)('detects ADQ: "%s"', (q) => {
      expect(service.detectModules(q)).toContain('ADQ');
    });
  });

  // ── REM — Remuneraciones y RRHH ───────────────────────────────────────────

  describe('REM — Remuneraciones y RRHH', () => {
    const remQuestions = [
      '¿Cuántos trabajadores están activos?',
      '¿Cuál es el total de sueldos del mes?',
      '¿Qué empleados tienen vacaciones?',
      'Muéstrame las liquidaciones de marzo',
      '¿Cuántos empleados están en AFP Habitat?',
      'Finiquitos del último trimestre',
    ];

    test.each(remQuestions)('detects REM: "%s"', (q) => {
      expect(service.detectModules(q)).toContain('REM');
    });
  });

  // ── CON — Contabilidad General ────────────────────────────────────────────

  describe('CON — Contabilidad General', () => {
    const conQuestions = [
      '¿Cuál es el balance del período?',
      'Asientos contables del mes',
      '¿Cuál es el resultado del ejercicio?',
      'Cuentas por conciliar',
      'Cierre contable de diciembre',
      'Mayor de la cuenta 4110',
    ];

    test.each(conQuestions)('detects CON: "%s"', (q) => {
      expect(service.detectModules(q)).toContain('CON');
    });
  });

  // ── SII — Documentos Tributarios ──────────────────────────────────────────

  describe('SII — Documentos Tributarios', () => {
    const siiQuestions = [
      '¿Cuántos DTE emitimos este mes?',
      '¿Cuál es el IVA del período?',
      'Facturas electrónicas pendientes',
      'Declaración del F29 de marzo',
      'Libro de ventas del trimestre',
    ];

    test.each(siiQuestions)('detects SII: "%s"', (q) => {
      expect(service.detectModules(q)).toContain('SII');
    });
  });

  // ── BAN — Bancos ──────────────────────────────────────────────────────────

  describe('BAN — Bancos', () => {
    const banQuestions = [
      '¿Cuál es el saldo bancario actual?',
      'Cheques emitidos esta semana',
      'Movimientos bancarios del mes',
      'Transferencias pendientes de conciliar',
      '¿Cuánto hay en la cuenta bancaria?',
    ];

    test.each(banQuestions)('detects BAN: "%s"', (q) => {
      expect(service.detectModules(q)).toContain('BAN');
    });
  });

  // ── IMP — Importaciones ───────────────────────────────────────────────────

  describe('IMP — Importaciones', () => {
    const impQuestions = [
      '¿Qué carpetas de importación están activas?',
      'Costos de internación del último trimestre',
      'Derechos aduaneros del embarque',
      '¿Cuánto se pagó de flete en el mes?',
    ];

    test.each(impQuestions)('detects IMP: "%s"', (q) => {
      expect(service.detectModules(q)).toContain('IMP');
    });
  });

  // ── AFF — Activo Fijo ─────────────────────────────────────────────────────

  describe('AFF — Activo Fijo', () => {
    const affQuestions = [
      '¿Cuánto se depreció en activos fijos este año?',
      'Bienes dados de baja en el período',
      '¿Cuál es el valor libro de los activos?',
    ];

    test.each(affQuestions)('detects AFF: "%s"', (q) => {
      expect(service.detectModules(q)).toContain('AFF');
    });
  });

  // ── Accent normalization ───────────────────────────────────────────────────

  describe('accent normalization', () => {
    it('matches "facturacion" (no accent) → VFA', () => {
      expect(service.detectModules('facturacion del mes')).toContain('VFA');
    });

    it('matches "facturación" (with accent) → VFA', () => {
      expect(service.detectModules('facturación del mes')).toContain('VFA');
    });

    it('matches "remuneracion" without accent → REM', () => {
      expect(service.detectModules('remuneracion del periodo')).toContain(
        'REM',
      );
    });

    it('matches "liquidacion" without accent → REM', () => {
      expect(service.detectModules('liquidacion de sueldos')).toContain('REM');
    });
  });

  // ── Case insensitivity ────────────────────────────────────────────────────

  describe('case insensitivity', () => {
    it('uppercase VENTAS → VFA', () => {
      expect(service.detectModules('VENTAS DEL MES')).toContain('VFA');
    });

    it('mixed case Facturas → VFA', () => {
      expect(service.detectModules('Facturas Emitidas')).toContain('VFA');
    });
  });

  // ── Ambiguous / empty questions → empty array ──────────────────────────────

  describe('ambiguous questions return empty array', () => {
    const ambiguous = [
      '¿Cómo vamos?',
      '¿Qué tal estamos?',
      'Dame información',
      'Resumen general',
      'hola',
      '',
    ];

    test.each(ambiguous)('no module for: "%s"', (q) => {
      expect(service.detectModules(q)).toHaveLength(0);
    });
  });

  // ── Multi-module detection ────────────────────────────────────────────────

  describe('multi-module detection', () => {
    it('question about sales AND collections → includes VFA and CCC', () => {
      const modules = service.detectModules(
        'Ventas del mes vs facturas con deuda vencida',
      );
      expect(modules).toContain('VFA');
      expect(modules).toContain('CCC');
    });

    it('returns at most 3 modules', () => {
      const modules = service.detectModules(
        'ventas facturas compras proveedores stock inventario balance contabilidad',
      );
      expect(modules.length).toBeLessThanOrEqual(3);
    });

    it('question crossing stock and purchasing → EXI or ADQ', () => {
      const modules = service.detectModules(
        'stock bajo y órdenes de compra pendientes',
      );
      // Should detect at least one of these
      const relevant = modules.filter((m) => ['EXI', 'ADQ'].includes(m));
      expect(relevant.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Direct prefix fallback ────────────────────────────────────────────────

  describe('direct prefix fallback', () => {
    it('question containing "VFA" directly → detects VFA', () => {
      const modules = service.detectModules('módulo VFA de este mes');
      expect(modules).toContain('VFA');
    });

    it('question containing "REM" directly → detects REM', () => {
      const modules = service.detectModules('quiero ver datos de REM');
      expect(modules).toContain('REM');
    });
  });

  // ── Return shape ──────────────────────────────────────────────────────────

  describe('return value contract', () => {
    it('always returns an array', () => {
      expect(Array.isArray(service.detectModules(''))).toBe(true);
      expect(Array.isArray(service.detectModules('ventas'))).toBe(true);
    });

    it('each element is a known module prefix', () => {
      const KNOWN = [
        'VFA',
        'CCC',
        'ADQ',
        'IMP',
        'EXI',
        'PRO',
        'AFF',
        'REM',
        'CON',
        'SII',
        'PAR',
        'DDI',
        'FIN',
        'CEA',
        'ATH',
        'BAN',
        'EGR',
        'CPC',
        'PED',
      ];
      const modules = service.detectModules(
        'ventas facturas stock compras remuneraciones banco',
      );
      for (const m of modules) {
        expect(KNOWN).toContain(m);
      }
    });
  });
});
