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
  PRO: { name: 'Productos', description: 'Maestro de artículos, categorías, unidades de medida, precios, lotes, trazabilidad',
    keywords: ['producto', 'artículo', 'ítem', 'sku', 'código', 'categoría', 'unidad', 'precio', 'lote'] },
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

  /** Get compact schema DDL for a list of module prefixes */
  getSchemaContext(prefixes: string[]): string {
    const lines: string[] = [];
    lines.push('-- I-NET ERP Schema (GeneXus 9.0.3 / SQL Server)');
    lines.push('-- Table prefix convention: table names start with module prefix');
    lines.push('-- Date format: YYYYMMDD stored as CHAR(8) or CHAR(6) for YYYYMM');
    lines.push('');

    for (const prefix of prefixes) {
      const mod = this.modules.get(prefix);
      if (!mod) continue;

      lines.push(`-- ═══ MODULE: ${mod.name} (${prefix}) ═══`);
      lines.push(`-- ${mod.description}`);
      lines.push('');

      for (const table of mod.tables) {
        if (table.attributes.length === 0) continue;
        lines.push(`-- ${table.description}`);
        lines.push(`CREATE TABLE ${table.name} (`);
        const colLines = table.attributes.map((a) => {
          const sqlType = this.toSqlType(a);
          const comment = a.title && a.title !== a.name ? ` -- ${a.title}` : '';
          return `  ${a.name} ${sqlType}${comment}`;
        });
        lines.push(colLines.join(',\n'));
        lines.push(');');
        lines.push('');
      }
    }

    return lines.join('\n');
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
