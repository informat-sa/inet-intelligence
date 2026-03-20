import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface Attribute {
  id: string;
  name: string;
  title: string;
  type: string;
  length: number;
  dec: number;
  prefix: string;
  desc?: string;
}

export interface SchemaModule {
  prefix: string;
  name: string;
  description: string;
  tables: SchemaTable[];
  keywords: string[];
}

export interface SchemaTable {
  name: string;
  description: string;
  attributes: Attribute[];
}

// Human-readable module definitions
const MODULE_META: Record<string, { name: string; description: string; keywords: string[] }> = {
  VFA: { name: 'Ventas y Facturación', description: 'Órdenes de venta, facturas, boletas, notas de crédito/débito, clientes, listas de precios',
    keywords: ['ventas', 'factura', 'boleta', 'venta', 'cliente', 'nota de crédito', 'nota de débito', 'ingreso', 'precio', 'descuento', 'cobro', 'guía', 'documentos'] },
  CCC: { name: 'Cuentas por Cobrar', description: 'Cartera de clientes, cuentas corrientes, cobranzas, vencimientos, morosidad',
    keywords: ['deuda', 'cobrar', 'moroso', 'cartera', 'vencida', 'vencimiento', 'pendiente pago', 'cuentas corrientes', 'cobranza'] },
  ADQ: { name: 'Adquisiciones y Compras', description: 'Órdenes de compra, cotizaciones, proveedores, recepciones de mercadería',
    keywords: ['compra', 'proveedor', 'orden de compra', 'cotización', 'recepción', 'adquisición', 'abastecimiento'] },
  IMP: { name: 'Importaciones', description: 'Carpetas de importación, gastos de internación, pólizas, derechos aduaneros, almacenes particulares',
    keywords: ['importación', 'internación', 'aduanero', 'derecho', 'carpeta', 'embarque', 'flete', 'póliza', 'seguro'] },
  EXI: { name: 'Existencias e Inventario', description: 'Control de stock, bodegas, movimientos, traspasos, ajustes de inventario, valorización',
    keywords: ['stock', 'inventario', 'bodega', 'existencia', 'movimiento', 'traspaso', 'saldo', 'unidades', 'mínimo', 'sin movimiento'] },
  PRO: { name: 'Producción y Maestro de Artículos', description: 'Órdenes de producción, fórmulas, máquinas, costos de producción, maestro de productos y proveedores',
    keywords: ['producción', 'orden producción', 'fórmula', 'máquina', 'producto', 'artículo', 'ítem', 'sku', 'fabricar', 'fabricación', 'proceso productivo', 'costo producción', 'hoja control', 'dotación', 'turno'] },
  AFF: { name: 'Activo Fijo', description: 'Bienes, depreciación, incorporaciones, bajas, traslados, revaluaciones',
    keywords: ['activo fijo', 'bien', 'depreciación', 'incorporación', 'baja', 'traslado', 'valor libro', 'valor residual'] },
  REM: { name: 'Remuneraciones y RRHH', description: 'Liquidación de sueldos, haberes, descuentos, AFP, ISAPRE, finiquitos, vacaciones',
    keywords: ['remuneración', 'sueldo', 'trabajador', 'empleado', 'afp', 'isapre', 'liquidación', 'finiquito', 'vacaciones', 'horas', 'turno'] },
  CON: { name: 'Contabilidad General', description: 'Plan de cuentas, asientos, centros de costo, conciliación bancaria, balance, resultado',
    keywords: ['contabilidad', 'asiento', 'cuenta', 'balance', 'resultado', 'centro de costo', 'conciliación', 'cierre', 'mayor', 'diario'] },
  SII: { name: 'SII y Documentos Tributarios', description: 'DTE, facturas electrónicas, libro de compras/ventas, IVA, F29, F50',
    keywords: ['sii', 'dte', 'factura electrónica', 'iva', 'libro de compras', 'libro de ventas', 'tributario', 'f29', 'declaración'] },
  PAR: { name: 'Parámetros del Sistema', description: 'Configuración global, monedas, tasas, tablas maestras, sucursales',
    keywords: ['parámetro', 'configuración', 'moneda', 'tasa', 'tipo de cambio', 'sucursal', 'tabla maestra'] },
  DDI: { name: 'Distribución y Despacho', description: 'Guías de despacho, rutas, transportistas, pedidos, entregas',
    keywords: ['despacho', 'guía', 'ruta', 'transporte', 'entrega', 'pedido', 'distribución', 'driver'] },
  FIN: { name: 'Finanzas y Tesorería', description: 'Flujo de caja, inversiones, préstamos, instrumentos financieros',
    keywords: ['tesorería', 'flujo de caja', 'inversión', 'préstamo', 'financiero', 'banco', 'caja'] },
  GAN: { name: 'Granos (Vertical Molinero)', description: 'Módulo vertical para empresas molineras: granos, trigo, romanajes, saldos',
    keywords: ['grano', 'trigo', 'molino', 'harina', 'romanaje', 'cereal', 'molinero'] },
  ATE: { name: 'Atención a Clientes', description: 'Tickets, solicitudes de servicio, contratos de mantención, SLA',
    keywords: ['atención', 'ticket', 'soporte', 'mantención', 'servicio', 'reclamo'] },
  BAN: { name: 'Bancos', description: 'Cuentas bancarias, movimientos bancarios, saldos, cheques, transferencias, conciliación',
    keywords: ['banco', 'cuenta bancaria', 'cheque', 'transferencia', 'saldo banco', 'movimiento banco', 'cartola', 'conciliación bancaria', 'depósito'] },
  EGR: { name: 'Egresos y Pagos', description: 'Egresos de caja, pagos a proveedores, formas de pago, autorización de gastos, análisis de egresos',
    keywords: ['egreso', 'pago proveedor', 'gasto', 'egreso directo', 'forma de pago', 'autorización pago', 'cuentas pagar', 'pago remun'] },
  COT: { name: 'Cotizaciones', description: 'Cotizaciones de proveedores, solicitudes de cotización, comparación de precios',
    keywords: ['cotización', 'cotizar', 'solicitud cotización', 'presupuesto proveedor', 'comparación precios', 'oferta proveedor'] },
  PED: { name: 'Pedidos', description: 'Pedidos de clientes, solicitudes, seguimiento de pedidos pendientes, órdenes no entregadas',
    keywords: ['pedido', 'solicitud pedido', 'pedido cliente', 'orden pendiente', 'pedido no entregado', 'seguimiento pedido', 'pedidos atendidos'] },
};

@Injectable()
export class SchemaService implements OnModuleInit {
  private readonly logger = new Logger(SchemaService.name);
  private modules: Map<string, SchemaModule> = new Map();
  private allAttributes: Attribute[] = [];

  async onModuleInit() {
    await this.loadSchema();
  }

  private async loadSchema() {
    const attrsPath = path.join(
      process.env.KB_DOCS_PATH ?? '/Users/ssegura1974/Desktop/INET/docs',
      '_full_attributes.json'
    );
    const objectsPath = path.join(
      process.env.KB_DOCS_PATH ?? '/Users/ssegura1974/Desktop/INET/docs',
      '_language_objects.json'
    );

    try {
      // Load attributes
      const attrsRaw = fs.readFileSync(attrsPath, 'utf-8');
      this.allAttributes = JSON.parse(attrsRaw) as Attribute[];

      // Load objects for table descriptions
      const objectsRaw = fs.readFileSync(objectsPath, 'utf-8');
      const langData = JSON.parse(objectsRaw);
      const transactions: Array<{ name: string; description: string; module_prefix: string }> =
        (langData.objects ?? []).filter((o: { type: string }) => o.type === 'Transaction');

      // Group attributes by prefix
      const attrsByPrefix = new Map<string, Attribute[]>();
      for (const attr of this.allAttributes) {
        const prefix = attr.prefix?.toUpperCase() ?? 'UNK';
        if (!attrsByPrefix.has(prefix)) attrsByPrefix.set(prefix, []);
        attrsByPrefix.get(prefix)!.push(attr);
      }

      // Build modules
      for (const [prefix, meta] of Object.entries(MODULE_META)) {
        const moduleTrans = transactions.filter((t) => t.module_prefix === prefix);
        const moduleAttrs = attrsByPrefix.get(prefix) ?? [];

        // Match attrs to tables
        const tablesSorted = moduleTrans.map((t) => t.name).sort((a, b) => b.length - a.length);
        const tableAttrMap = new Map<string, Attribute[]>();
        const unmatched: Attribute[] = [];

        for (const attr of moduleAttrs) {
          let matched = false;
          for (const tname of tablesSorted) {
            if (attr.name.toUpperCase().startsWith(tname.toUpperCase())) {
              if (!tableAttrMap.has(tname)) tableAttrMap.set(tname, []);
              tableAttrMap.get(tname)!.push(attr);
              matched = true;
              break;
            }
          }
          if (!matched) unmatched.push(attr);
        }

        const tables: SchemaTable[] = moduleTrans.map((t) => ({
          name: t.name,
          description: t.description,
          attributes: tableAttrMap.get(t.name) ?? [],
        }));

        this.modules.set(prefix, {
          prefix,
          name: meta.name,
          description: meta.description,
          keywords: meta.keywords,
          tables,
        });
      }

      this.logger.log(`Schema loaded: ${this.allAttributes.length} attributes, ${transactions.length} tables, ${this.modules.size} modules`);
    } catch (err) {
      this.logger.error('Failed to load schema from KB files', err);
      this.logger.warn('Running with empty schema — queries will fail');
    }
  }

  /** Detect which modules are relevant for a given question */
  detectModules(question: string): string[] {
    const lower = question.toLowerCase();
    const scores: Array<{ prefix: string; score: number }> = [];

    for (const [prefix, mod] of this.modules) {
      let score = 0;
      for (const kw of mod.keywords) {
        if (lower.includes(kw)) score += kw.split(' ').length; // longer keywords score higher
      }
      if (score > 0) scores.push({ prefix, score });
    }

    scores.sort((a, b) => b.score - a.score);

    // Return top 3 modules (or all that scored > 0)
    const result = scores.slice(0, 3).map((s) => s.prefix);

    // Fallback: check by prefix in question
    if (result.length === 0) {
      for (const prefix of this.modules.keys()) {
        if (lower.includes(prefix.toLowerCase())) result.push(prefix);
      }
    }

    // Last resort: return top 2 most common modules
    if (result.length === 0) return ['VFA', 'EXI'];

    return result;
  }

  /**
   * Get schema context for a list of module prefixes.
   *
   * Optimizations applied:
   * 1. Smart Table Selection: if `question` is provided, ranks tables by
   *    keyword relevance and returns only the top N per module (~85% fewer tokens)
   * 2. Compact format: uses [TABLE] shorthand instead of full DDL (~3x fewer tokens)
   */
  getSchemaContext(prefixes: string[], question?: string): string {
    const MAX_TABLES_PER_MODULE = 8;  // Top-N most relevant tables
    const lines: string[] = [];
    lines.push('-- I-NET ERP (SQL Server). Fechas: CHAR(8)=YYYYMMDD, CHAR(6)=YYYYMM');
    lines.push('-- Mes actual: CONVERT(CHAR(6),GETDATE(),112)');
    lines.push('');

    for (const prefix of prefixes) {
      const mod = this.modules.get(prefix);
      if (!mod) continue;

      lines.push(`-- ${mod.name} (${prefix}): ${mod.description}`);

      // ── Optimization 2: Smart Table Selection ──────────────────────────
      const tables = question
        ? this.rankTablesByRelevance(mod.tables, question).slice(0, MAX_TABLES_PER_MODULE)
        : mod.tables.slice(0, MAX_TABLES_PER_MODULE);

      for (const table of tables) {
        if (table.attributes.length === 0) continue;

        // ── Optimization 4: Compact schema format (3x fewer tokens) ───────
        const cols = table.attributes
          .map((a) => `${a.name}:${this.toCompactType(a)}`)
          .join(' ');
        lines.push(`[${table.name}] ${table.description}`);
        lines.push(`  ${cols}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Rank tables by keyword relevance to the question.
   * Score = number of question words that appear in table name or description.
   */
  private rankTablesByRelevance(tables: SchemaTable[], question: string): SchemaTable[] {
    const words = question
      .toLowerCase()
      .replace(/[^\wáéíóúñü\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    return tables
      .map((t) => {
        const target = `${t.name} ${t.description ?? ''}`.toLowerCase();
        const score = words.reduce((acc, w) => acc + (target.includes(w) ? 1 : 0), 0);
        return { table: t, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.table);
  }

  /** Compact type notation: N10, C8, N15.2, DATE, etc. */
  private toCompactType(a: Attribute): string {
    const t = (a.type ?? '').toLowerCase();
    const len = a.length ?? 0;
    const dec = a.dec ?? 0;
    if (t === 'date' || t === 'd') return 'DATE';
    if (t === 'datetime' || t === 'a') return 'DATETIME';
    if (t === 'boolean' || t === 'b') return 'BIT';
    if (t === 'numeric' || t === 'n') return dec > 0 ? `N${len}.${dec}` : `N${len}`;
    if (t === 'varchar' || t === 'vchar') return `VC${len}`;
    if (t === 'string') {
      if (len === 0) return 'N14.2';
      return dec > 0 ? `N${len}.${dec}` : `C${len}`;
    }
    if (len > 0) return dec > 0 ? `N${len}.${dec}` : `C${len}`;
    return 'VC255';
  }

  private toSqlType(a: Attribute): string {
    const t = (a.type ?? '').toLowerCase();
    const len = a.length ?? 0;
    const dec = a.dec ?? 0;
    if (t === 'date' || t === 'd') return 'DATE';
    if (t === 'datetime' || t === 'a') return 'DATETIME';
    if (t === 'boolean' || t === 'b') return 'BIT';
    if (t === 'numeric' || t === 'n') return dec > 0 ? `NUMERIC(${len},${dec})` : `NUMERIC(${len})`;
    if (t === 'varchar' || t === 'vchar') return `VARCHAR(${len})`;
    if (t === 'longvarchar' || t === 'longvchar') return 'TEXT';
    if (t === 'blob') return 'VARBINARY(MAX)';
    if (t === 'string') {
      if (len === 0) return 'NUMERIC(14,2)';
      return dec > 0 ? `NUMERIC(${len},${dec})` : `CHAR(${len})`;
    }
    if (len > 0) return dec > 0 ? `NUMERIC(${len},${dec})` : `CHAR(${len})`;
    return 'VARCHAR(255)';
  }

  getModule(prefix: string): SchemaModule | undefined {
    return this.modules.get(prefix);
  }

  getAllModules(): SchemaModule[] {
    return Array.from(this.modules.values());
  }
}
