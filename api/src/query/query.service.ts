import { Injectable, Logger, Optional } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { SchemaService } from '../schema/schema.service';
import { DatabaseService, TenantConnectionInfo } from '../database/database.service';
import { TenantsService } from '../tenants/tenants.service';
import { validateAndSanitizeSQL } from './sql-validator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import type { MessageStreamEvent } from '@anthropic-ai/sdk/resources/messages.mjs';

export interface StreamEvent {
  type: 'delta' | 'result' | 'done' | 'error';
  delta?: string;
  result?: QueryResult;
  modulesUsed?: string[];
  suggestedFollowUps?: string[];
  error?: string;
}

export interface QueryResult {
  type: 'table' | 'chart' | 'scalar' | 'text' | 'error';
  data?: Record<string, unknown>[];
  columns?: ColumnDef[];
  sql?: string;
  rowCount?: number;
  chartConfig?: ChartConfig;
}

interface ColumnDef { key: string; label: string; type: string; align?: string }
interface ChartConfig { type: string; xKey: string; yKey: string; yLabel?: string }

const SYSTEM_PROMPT = `Eres I-NET Intelligence, un asistente de análisis de datos para I-NET ERP de Informat.
Tu tarea es responder preguntas de negocio en español consultando una base de datos SQL Server.

REGLAS CRÍTICAS:
1. SIEMPRE genera SQL válido para SQL Server (T-SQL)
2. SOLO usa SELECT — NUNCA INSERT, UPDATE, DELETE, DROP, ni DDL
3. Usa el schema exacto provisto (nombres de tabla y columna)
4. Limita resultados con TOP cuando sea apropiado
5. Para fechas: los campos tipo CHAR(8) guardan YYYYMMDD, CHAR(6) guardan YYYYMM
6. Para meses actuales: usa CONVERT(CHAR(6), GETDATE(), 112) como 'YYYYMM'
7. Responde SIEMPRE en español
8. Sé conciso y directo: da el resultado primero, luego el análisis
9. Si el SQL retorna datos numéricos comparativos, sugiere si se vería bien en un gráfico
10. Al final de tu respuesta incluye 2-3 preguntas de seguimiento relevantes en formato JSON:
    [FOLLOWUPS]
    ["¿pregunta 1?", "¿pregunta 2?", "¿pregunta 3?"]
    [/FOLLOWUPS]

FORMATO DE RESPUESTA cuando hay datos:
- Primero da el insight principal en 1-2 oraciones
- Luego la tabla o números
- Termina con contexto o recomendación breve si aplica`;

@Injectable()
export class QueryService {
  private readonly logger = new Logger(QueryService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly schemaService: SchemaService,
    private readonly databaseService: DatabaseService,
    @Optional() private readonly tenantsService: TenantsService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    });
  }

  async *streamQuery(
    question: string,
    jwtUser: JwtPayload,
    forcedModules?: string[],
  ): AsyncGenerator<StreamEvent> {
    // 1. Determine modules: forced (from active module context) or auto-detected
    const detectedModules = forcedModules?.length
      ? forcedModules
      : this.schemaService.detectModules(question);

    // 2. ── Permission enforcement via JWT ──────────────────────────────────
    const allowedModules = jwtUser?.allowedModules ?? [];
    const modulePrefixes = detectedModules.length > 0
      ? detectedModules.filter((p) => allowedModules.length === 0 || allowedModules.includes(p))
      : allowedModules.slice(0, 3);

    if (detectedModules.length > 0 && modulePrefixes.length === 0) {
      yield {
        type:  'error',
        error: 'No tienes permiso para consultar los módulos detectados en esta pregunta. ' +
               'Contacta al administrador.',
      };
      return;
    }

    const tenantLabel = jwtUser?.tenantSlug ?? 'demo';
    this.logger.log(`[${tenantLabel}] "${question.slice(0, 60)}" → módulos: ${modulePrefixes.join(', ')}`);

    // 3. Demo mode check
    const isDemoMode =
      process.env.DEMO_MODE === 'true' ||
      !process.env.ANTHROPIC_API_KEY ||
      process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here';

    if (isDemoMode) {
      yield* this.streamDemoResponse(question, modulePrefixes);
      return;
    }

    // 4. Resolve tenant SQL Server connection
    let tenantInfo: TenantConnectionInfo | null = null;
    if (jwtUser?.tenantId) {
      const tenant = await this.tenantsService.findById(jwtUser.tenantId);
      if (tenant) tenantInfo = tenant as unknown as TenantConnectionInfo;
    }

    // 5. ── Optimization 2: Smart Table Selection ───────────────────────────
    // Pass question so schema service returns only the top-N most relevant
    // tables per module (reduces schema tokens by ~85%)
    const schemaContext = this.schemaService.getSchemaContext(modulePrefixes, question);

    // 6. ── Optimization 3: Model Routing ──────────────────────────────────
    const model = this.selectModel(question, modulePrefixes.length);
    this.logger.log(`[${tenantLabel}] Model: ${model}`);

    // 7. Stream from Claude with all optimizations
    let fullText = '';
    let sqlExecuted = false;

    try {
      // ── Optimization 1: Prompt Caching on system + schema ─────────────
      const stream = await this.anthropic.messages.stream({
        model,
        max_tokens: 2048,
        system: [{
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        }] as any,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: schemaContext,
              cache_control: { type: 'ephemeral' },
            },
            {
              type: 'text',
              text: `Pregunta: ${question}\n\nGenera SQL T-SQL entre [SQL] y [/SQL] e interpreta los resultados en español.`,
            },
          ] as any,
        }],
      });

      // ── Optimization 5: Log token usage for cost monitoring ───────────
      stream.on('message', (msg) => {
        const usage = (msg as any).usage;
        if (usage) {
          this.logger.log(
            `[${tenantLabel}] Tokens — input: ${usage.input_tokens} ` +
            `(cached: ${usage.cache_read_input_tokens ?? 0}) output: ${usage.output_tokens}`,
          );
        }
      });

      for await (const event of stream as AsyncIterable<MessageStreamEvent>) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const delta = event.delta.text;
          fullText += delta;

          if (!this.isInsideSqlBlock(fullText)) {
            yield { type: 'delta', delta };
          }

          if (!sqlExecuted && fullText.includes('[/SQL]')) {
            const match = fullText.match(/\[SQL\]([\s\S]*?)\[\/SQL\]/);
            if (match) {
              sqlExecuted = true;
              const execResult = await this.executeSQL(match[1].trim(), tenantInfo);
              if (execResult) yield { type: 'result', result: execResult };
            }
          }
        }
      }

      const followUps = this.extractFollowUps(fullText);
      yield { type: 'delta', delta: '' };
      yield { type: 'done', modulesUsed: modulePrefixes, suggestedFollowUps: followUps };
    } catch (err) {
      this.logger.error('Query stream error', err);
      yield { type: 'error', error: err instanceof Error ? err.message : 'Error desconocido' };
    }
  }

  // ── Optimization 3: Model routing ────────────────────────────────────────
  private selectModel(question: string, moduleCount: number): string {
    const isSimple =
      moduleCount === 1 &&
      question.split(' ').length < 15 &&
      !/comparar|vs\.?|versus|tendencia|período|evoluci|ranking|top\s*\d/i.test(question);
    return isSimple ? 'claude-haiku-4-5' : 'claude-sonnet-4-5';
  }

  /** Demo mode: simulate Claude streaming with realistic ERP responses */
  private async *streamDemoResponse(
    question: string,
    modulePrefixes: string[],
  ): AsyncGenerator<StreamEvent> {
    const q = question.toLowerCase();

    // Pick a demo scenario based on keywords
    const scenario = this.pickDemoScenario(q, modulePrefixes);

    // Stream the text word-by-word with a realistic delay
    for (const chunk of scenario.textChunks) {
      yield { type: 'delta', delta: chunk };
      await this.sleep(18 + Math.random() * 30);
    }

    // Yield the data result
    yield { type: 'result', result: scenario.result };

    // Small pause then done
    await this.sleep(300);
    yield {
      type: 'done',
      modulesUsed: modulePrefixes,
      suggestedFollowUps: scenario.followUps,
    };
  }

  private pickDemoScenario(q: string, prefixes: string[]): DemoScenario {
    // Ventas / ventas comparativo
    if (/vend|venta|factur|ingreso/.test(q)) {
      return DEMO_SCENARIOS.ventas;
    }
    // Cobranzas / deudas / morosidad
    if (/cobr|deud|moroso|factura.*pago|pago.*factura|90 d/.test(q)) {
      return DEMO_SCENARIOS.cobranzas;
    }
    // Inventario / stock
    if (/stock|inventario|producto.*bajo|m[ií]nimo/.test(q)) {
      return DEMO_SCENARIOS.inventario;
    }
    // Compras / proveedores
    if (/compr|proveedor/.test(q)) {
      return DEMO_SCENARIOS.compras;
    }
    // Remuneraciones / trabajadores
    if (/trabajador|empleado|sucursal|remuner|sueldo/.test(q)) {
      return DEMO_SCENARIOS.remuneraciones;
    }
    // Importaciones
    if (/import|carpeta|aduana|carga/.test(q)) {
      return DEMO_SCENARIOS.importaciones;
    }
    // Default
    return DEMO_SCENARIOS.ventas;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private isInsideSqlBlock(text: string): boolean {
    const sqlStart = text.lastIndexOf('[SQL]');
    const sqlEnd = text.lastIndexOf('[/SQL]');
    return sqlStart !== -1 && sqlStart > sqlEnd;
  }

  private async executeSQL(rawSql: string, tenant: TenantConnectionInfo | null = null): Promise<QueryResult | null> {
    const validation = validateAndSanitizeSQL(rawSql);
    if (!validation.valid) {
      this.logger.warn(`SQL validation failed: ${validation.error}`);
      return { type: 'error', sql: rawSql };
    }

    if (!tenant && !this.databaseService.isConnected()) {
      this.logger.warn('Database not connected — returning mock data');
      return this.getMockResult(validation.sql);
    }

    try {
      const result = await this.databaseService.executeQuery(validation.sql, tenant);
      const cols: ColumnDef[] = result.columns.map((c) => ({
        key:   c.name,
        label: c.name,
        type:  this.inferColType(c.name, c.type),
        align: this.inferColType(c.name, c.type) === 'number' ? 'right' : 'left',
      }));

      return {
        type:     'table',
        data:     result.rows,
        columns:  cols,
        sql:      validation.sql,
        rowCount: result.rowCount,
        chartConfig: this.inferChartConfig(result.rows, cols),
      };
    } catch (err) {
      this.logger.error('SQL execution error', err);
      return { type: 'error', sql: validation.sql };
    }
  }

  private inferColType(name: string, dbType: string): string {
    const n = name.toLowerCase();
    if (/monto|total|valor|precio|costo|saldo|importe|deuda/.test(n)) return 'currency';
    if (/fecha|fch|date/.test(n)) return 'date';
    if (/cantidad|cant|num|cnt|count/.test(n)) return 'number';
    if (dbType.toLowerCase().includes('int') || dbType.toLowerCase().includes('decimal')) return 'number';
    return 'string';
  }

  private inferChartConfig(rows: Record<string, unknown>[], cols: ColumnDef[]): ChartConfig | undefined {
    if (rows.length < 2 || rows.length > 50) return undefined;
    const numCols = cols.filter((c) => c.type === 'number' || c.type === 'currency');
    const strCols = cols.filter((c) => c.type === 'string');
    if (numCols.length >= 1 && strCols.length >= 1) {
      return { type: 'bar', xKey: strCols[0].key, yKey: numCols[0].key, yLabel: numCols[0].label };
    }
    return undefined;
  }

  private extractFollowUps(text: string): string[] {
    const match = text.match(/\[FOLLOWUPS\]\s*([\s\S]*?)\s*\[\/FOLLOWUPS\]/);
    if (!match) return [];
    try {
      return JSON.parse(match[1]) as string[];
    } catch {
      return [];
    }
  }

  private cleanResponse(text: string): string {
    return text
      .replace(/\[SQL\][\s\S]*?\[\/SQL\]/g, '')
      .replace(/\[FOLLOWUPS\][\s\S]*?\[\/FOLLOWUPS\]/g, '')
      .trim();
  }

  /** Mock result when DB is not connected (for development) */
  private getMockResult(sql: string): QueryResult {
    return {
      type: 'table',
      sql,
      rowCount: 3,
      data: [
        { Cliente: 'Empresa ABC SpA', MontoDeuda: 4500000, DiasVencidos: 92 },
        { Cliente: 'Comercial XYZ Ltda', MontoDeuda: 2800000, DiasVencidos: 67 },
        { Cliente: 'Distribuidora 123', MontoDeuda: 1200000, DiasVencidos: 45 },
      ],
      columns: [
        { key: 'Cliente',     label: 'Cliente',       type: 'string',   align: 'left'  },
        { key: 'MontoDeuda',  label: 'Monto Deuda',   type: 'currency', align: 'right' },
        { key: 'DiasVencidos',label: 'Días Vencidos', type: 'number',   align: 'right' },
      ],
      chartConfig: { type: 'bar', xKey: 'Cliente', yKey: 'MontoDeuda', yLabel: 'Monto ($)' },
    };
  }
}

// ─── Demo Scenarios ────────────────────────────────────────────────────────────

interface DemoScenario {
  textChunks: string[];
  result: QueryResult;
  followUps: string[];
}

function chunks(text: string): string[] {
  // Split into ~3-char pieces to simulate token streaming
  const result: string[] = [];
  for (let i = 0; i < text.length; i += 4) {
    result.push(text.slice(i, i + 4));
  }
  return result;
}

const DEMO_SCENARIOS: Record<string, DemoScenario> = {
  ventas: {
    textChunks: chunks(
      'Las ventas de este mes totalizan **$847.320.450**, lo que representa un aumento del **12,4%** respecto al mismo período del año anterior ($753.890.200).\n\n' +
      'Los canales con mejor desempeño son **Venta Directa** (+18%) y **Distribuidores** (+9%). ' +
      'El único canal con caída es **Exportaciones** (-3%), afectado por el tipo de cambio.\n\n' +
      '**Recomendación:** El crecimiento está en línea con la meta anual del 15%. ' +
      'Se recomienda reforzar el canal directo que muestra la mayor tracción.',
    ),
    result: {
      type: 'table',
      sql: "SELECT Canal, SUM(MontoNeto) AS VentasMes, SUM(MontoNetoPY) AS VentasAñoAnterior,\n  ROUND((SUM(MontoNeto) - SUM(MontoNetoPY)) * 100.0 / NULLIF(SUM(MontoNetoPY),0), 1) AS Variacion\nFROM VFA_VENTA_CABECERA\nWHERE PeriodoMes = CONVERT(CHAR(6),GETDATE(),112)\nGROUP BY Canal ORDER BY VentasMes DESC",
      rowCount: 4,
      data: [
        { Canal: 'Venta Directa',  VentasMes: 412500000, VentasAñoAnterior: 350100000, Variacion: 18.1 },
        { Canal: 'Distribuidores', VentasMes: 285320450, VentasAñoAnterior: 261900000, Variacion:  9.0 },
        { Canal: 'Retail',         VentasMes:  98000000, VentasAñoAnterior:  95000000, Variacion:  3.2 },
        { Canal: 'Exportaciones',  VentasMes:  51500000, VentasAñoAnterior:  53000000, Variacion: -2.8 },
      ],
      columns: [
        { key: 'Canal',             label: 'Canal',            type: 'string',   align: 'left'  },
        { key: 'VentasMes',         label: 'Ventas Mes ($)',   type: 'currency', align: 'right' },
        { key: 'VentasAñoAnterior', label: 'Año Anterior ($)', type: 'currency', align: 'right' },
        { key: 'Variacion',         label: 'Variación %',      type: 'number',   align: 'right' },
      ],
      chartConfig: { type: 'bar', xKey: 'Canal', yKey: 'VentasMes', yLabel: 'Monto ($)' },
    },
    followUps: [
      '¿Cuáles son los 10 clientes con mayor venta este mes?',
      '¿Qué productos concentran el 80% de las ventas?',
      '¿Cómo van las ventas vs la meta mensual por vendedor?',
    ],
  },

  cobranzas: {
    textChunks: chunks(
      'Existen **23 facturas** con más de 90 días sin pago, que totalizan **$38.450.000** en deuda vencida crítica.\n\n' +
      'Los 3 clientes de mayor riesgo concentran el **67%** del total: ' +
      'Constructora del Norte SpA ($12.8M), Comercial Pérez Ltda ($8.2M) y Ferretería Central ($5.8M).\n\n' +
      '**⚠ Acción recomendada:** Iniciar gestión de cobranza prejudicial para los primeros 5 clientes. ' +
      'La provisión por incobrables recomendada es de $7.690.000 (20% del total vencido).',
    ),
    result: {
      type: 'table',
      sql: "SELECT TOP 10 c.NombreCliente AS Cliente,\n  SUM(f.MontoTotal) AS DeudaTotal,\n  MAX(DATEDIFF(day, f.FechaVencimiento, GETDATE())) AS MaxDiasVencido,\n  COUNT(*) AS NroFacturas\nFROM CCC_FACTURA f\nJOIN VFA_CLIENTE c ON c.CodCliente = f.CodCliente\nWHERE f.Pagada = 0 AND DATEDIFF(day, f.FechaVencimiento, GETDATE()) > 90\nGROUP BY c.NombreCliente\nORDER BY DeudaTotal DESC",
      rowCount: 8,
      data: [
        { Cliente: 'Constructora del Norte SpA', DeudaTotal: 12800000, MaxDiasVencido: 147, NroFacturas: 4 },
        { Cliente: 'Comercial Pérez Ltda',        DeudaTotal:  8200000, MaxDiasVencido: 132, NroFacturas: 3 },
        { Cliente: 'Ferretería Central',          DeudaTotal:  5800000, MaxDiasVencido: 118, NroFacturas: 2 },
        { Cliente: 'Importadora Rápida',          DeudaTotal:  4100000, MaxDiasVencido: 103, NroFacturas: 2 },
        { Cliente: 'Servicios Globales SpA',       DeudaTotal:  2950000, MaxDiasVencido:  97, NroFacturas: 3 },
        { Cliente: 'Distribuciones Sur Ltda',     DeudaTotal:  2300000, MaxDiasVencido:  95, NroFacturas: 1 },
        { Cliente: 'Comercial Rivera',            DeudaTotal:  1500000, MaxDiasVencido:  91, NroFacturas: 1 },
        { Cliente: 'Industrial Moderna SpA',       DeudaTotal:   800000, MaxDiasVencido:  91, NroFacturas: 1 },
      ],
      columns: [
        { key: 'Cliente',        label: 'Cliente',          type: 'string',   align: 'left'  },
        { key: 'DeudaTotal',     label: 'Deuda Total ($)',  type: 'currency', align: 'right' },
        { key: 'MaxDiasVencido', label: 'Días Vencido',    type: 'number',   align: 'right' },
        { key: 'NroFacturas',    label: 'N° Facturas',     type: 'number',   align: 'right' },
      ],
      chartConfig: { type: 'bar', xKey: 'Cliente', yKey: 'DeudaTotal', yLabel: 'Deuda ($)' },
    },
    followUps: [
      '¿Cuánto suma la deuda total por rangos de antigüedad (30/60/90/+90 días)?',
      '¿Qué facturas de Constructora del Norte SpA están pendientes?',
      '¿Cuál es la tasa de cobranza del último trimestre?',
    ],
  },

  inventario: {
    textChunks: chunks(
      'Se detectaron **34 productos** con stock actual por debajo del stock mínimo configurado, ' +
      'con un riesgo de quiebre de stock en los próximos **7 días** para los 5 críticos.\n\n' +
      'El valor total del faltante estimado (para reponer al nivel mínimo) es de **$4.230.000**. ' +
      'La categoría más afectada es **Ferretería Industrial** con 12 SKUs bajo mínimo.\n\n' +
      '**Recomendación:** Generar orden de compra inmediata para los 5 productos críticos. ' +
      'El lead time promedio del proveedor principal es 3 días hábiles.',
    ),
    result: {
      type: 'table',
      sql: "SELECT TOP 15 p.DescProducto AS Producto, p.CodProducto,\n  i.StockActual, p.StockMinimo,\n  (p.StockMinimo - i.StockActual) AS Faltante,\n  i.StockActual * p.CostoUnitario AS ValorStock\nFROM EXI_PRODUCTO p\nJOIN EXI_INVENTARIO i ON i.CodProducto = p.CodProducto\nWHERE i.StockActual < p.StockMinimo\nORDER BY Faltante DESC",
      rowCount: 8,
      data: [
        { Producto: 'Perno Hexagonal 3/8"',   CodProducto: 'FER-001', StockActual:  5, StockMinimo: 100, Faltante: 95, ValorStock:  12500 },
        { Producto: 'Tuerca M12 Galvanizada', CodProducto: 'FER-002', StockActual: 12, StockMinimo:  80, Faltante: 68, ValorStock:  18000 },
        { Producto: 'Cable AWG 12 (metro)',   CodProducto: 'ELE-007', StockActual:  8, StockMinimo:  50, Faltante: 42, ValorStock:  24000 },
        { Producto: 'Pintura Epóxica 4L',     CodProducto: 'PIN-003', StockActual:  3, StockMinimo:  30, Faltante: 27, ValorStock:  45000 },
        { Producto: 'Disco Corte 9"',         CodProducto: 'HER-011', StockActual:  7, StockMinimo:  25, Faltante: 18, ValorStock:  21000 },
      ],
      columns: [
        { key: 'Producto',     label: 'Producto',      type: 'string',   align: 'left'  },
        { key: 'CodProducto',  label: 'Código',        type: 'string',   align: 'left'  },
        { key: 'StockActual',  label: 'Stock Actual',  type: 'number',   align: 'right' },
        { key: 'StockMinimo',  label: 'Mínimo',        type: 'number',   align: 'right' },
        { key: 'Faltante',     label: 'Faltante',      type: 'number',   align: 'right' },
        { key: 'ValorStock',   label: 'Valor Stock ($)', type: 'currency', align: 'right' },
      ],
      chartConfig: undefined,
    },
    followUps: [
      '¿Qué proveedor surte los productos con mayor quiebre de stock?',
      '¿Cuántos días de cobertura tiene el inventario actual de Ferretería Industrial?',
      '¿Cuáles son los 20 productos con mayor rotación del último mes?',
    ],
  },

  compras: {
    textChunks: chunks(
      'Durante este año se realizaron compras por un total de **$1.284.750.000** distribuidas entre **47 proveedores activos**.\n\n' +
      'Los 5 proveedores principales concentran el **72%** del gasto total. ' +
      'El proveedor con mayor facturación es **Aceros del Pacífico S.A.** con $287M (22% del total).\n\n' +
      '**Oportunidad:** 3 proveedores representan más del 10% del gasto cada uno. ' +
      'Se recomienda revisar condiciones de pago y evaluar descuentos por volumen en la próxima negociación.',
    ),
    result: {
      type: 'table',
      sql: "SELECT TOP 10 p.NombreProveedor AS Proveedor,\n  SUM(oc.MontoTotal) AS TotalCompras,\n  COUNT(oc.NroOrden) AS NroOrdenes,\n  AVG(oc.DiasCredito) AS DiasCredProm\nFROM ADQ_ORDEN_COMPRA oc\nJOIN ADQ_PROVEEDOR p ON p.CodProveedor = oc.CodProveedor\nWHERE YEAR(oc.FechaEmision) = YEAR(GETDATE())\nGROUP BY p.NombreProveedor\nORDER BY TotalCompras DESC",
      rowCount: 5,
      data: [
        { Proveedor: 'Aceros del Pacífico S.A.',   TotalCompras: 287000000, NroOrdenes: 24, DiasCredProm: 45 },
        { Proveedor: 'Distribuidora Metal Ltda',  TotalCompras: 198500000, NroOrdenes: 31, DiasCredProm: 30 },
        { Proveedor: 'Comercial Química SpA',      TotalCompras: 156200000, NroOrdenes: 18, DiasCredProm: 60 },
        { Proveedor: 'Importadora Técnica S.A.',   TotalCompras:  98400000, NroOrdenes: 12, DiasCredProm: 45 },
        { Proveedor: 'Ferretería Industrial CL',  TotalCompras:  84100000, NroOrdenes: 42, DiasCredProm: 15 },
      ],
      columns: [
        { key: 'Proveedor',     label: 'Proveedor',         type: 'string',   align: 'left'  },
        { key: 'TotalCompras',  label: 'Total Compras ($)', type: 'currency', align: 'right' },
        { key: 'NroOrdenes',    label: 'N° Órdenes',       type: 'number',   align: 'right' },
        { key: 'DiasCredProm',  label: 'Días Crédito',     type: 'number',   align: 'right' },
      ],
      chartConfig: { type: 'bar', xKey: 'Proveedor', yKey: 'TotalCompras', yLabel: 'Compras ($)' },
    },
    followUps: [
      '¿Qué órdenes de compra están pendientes de recepción?',
      '¿Cuánto se pagó a Aceros del Pacífico en los últimos 90 días?',
      '¿Qué productos se compran con mayor frecuencia y a qué precio promedio?',
    ],
  },

  remuneraciones: {
    textChunks: chunks(
      'La empresa cuenta con **312 trabajadores activos** distribuidos en **8 sucursales**. ' +
      'La sucursal con mayor dotación es **Casa Matriz Santiago** con 94 empleados (30%).\n\n' +
      'El costo total de remuneraciones del mes es de **$187.430.000**, incluyendo sueldos base, ' +
      'gratificaciones e imposiciones. El costo promedio por trabajador es **$601.000**.\n\n' +
      '**Dato:** La sucursal Antofagasta tiene el menor costo promedio ($520.000) mientras que ' +
      'Operaciones Santiago tiene el mayor ($840.000), consistente con el perfil de cargos.',
    ),
    result: {
      type: 'table',
      sql: "SELECT s.NombreSucursal AS Sucursal,\n  COUNT(t.RutTrabajador) AS NroTrabajadores,\n  SUM(r.SueldoLiquido) AS TotalRemuneraciones,\n  AVG(r.SueldoLiquido) AS PromedioSueldo\nFROM REM_TRABAJADOR t\nJOIN REM_REMUNERACION r ON r.RutTrabajador = t.RutTrabajador\nJOIN REM_SUCURSAL s ON s.CodSucursal = t.CodSucursal\nWHERE t.Activo = 1 AND r.Periodo = CONVERT(CHAR(6),GETDATE(),112)\nGROUP BY s.NombreSucursal\nORDER BY NroTrabajadores DESC",
      rowCount: 6,
      data: [
        { Sucursal: 'Casa Matriz Santiago', NroTrabajadores:  94, TotalRemuneraciones:  79330000, PromedioSueldo: 844000 },
        { Sucursal: 'Operaciones Santiago', NroTrabajadores:  61, TotalRemuneraciones:  51240000, PromedioSueldo: 840000 },
        { Sucursal: 'Valparaíso',           NroTrabajadores:  48, TotalRemuneraciones:  28990000, PromedioSueldo: 604000 },
        { Sucursal: 'Concepción',           NroTrabajadores:  42, TotalRemuneraciones:  24700000, PromedioSueldo: 588000 },
        { Sucursal: 'Antofagasta',          NroTrabajadores:  38, TotalRemuneraciones:  19750000, PromedioSueldo: 520000 },
        { Sucursal: 'Puerto Montt',         NroTrabajadores:  29, TotalRemuneraciones:  15420000, PromedioSueldo: 532000 },
      ],
      columns: [
        { key: 'Sucursal',              label: 'Sucursal',            type: 'string',   align: 'left'  },
        { key: 'NroTrabajadores',       label: 'N° Trabajadores',    type: 'number',   align: 'right' },
        { key: 'TotalRemuneraciones',   label: 'Costo Total ($)',     type: 'currency', align: 'right' },
        { key: 'PromedioSueldo',        label: 'Sueldo Promedio ($)', type: 'currency', align: 'right' },
      ],
      chartConfig: { type: 'bar', xKey: 'Sucursal', yKey: 'TotalRemuneraciones', yLabel: 'Costo ($)' },
    },
    followUps: [
      '¿Cuántos trabajadores cumplen años este mes y cuáles son sus cargos?',
      '¿Qué contratos vencen en los próximos 30 días?',
      '¿Cuánto representa el costo de remuneraciones como % de la venta del mes?',
    ],
  },

  importaciones: {
    textChunks: chunks(
      'Hay **18 carpetas de importación abiertas** por un valor CIF total de **USD 2.847.500**. ' +
      'De estas, **5 están en tránsito** (estimadas a llegar esta semana) y **4 están en aduana** esperando DIN.\n\n' +
      'La carpeta más antigua en proceso es la **IMP-2024-0891** con 67 días desde su apertura, ' +
      'correspondiente a maquinaria industrial desde Alemania.\n\n' +
      '**Alerta:** 2 carpetas tienen gastos adicionales pendientes de regularizar. ' +
      'Se recomienda revisar con el agente de aduanas antes del cierre mensual.',
    ),
    result: {
      type: 'table',
      sql: "SELECT TOP 10 i.NroCarpeta, i.Proveedor, i.PaisOrigen,\n  i.MontoFOB_USD, i.EstadoCarpeta,\n  DATEDIFF(day, i.FechaApertura, GETDATE()) AS DiasEnProceso\nFROM IMP_CARPETA i\nWHERE i.EstadoCarpeta NOT IN ('CERRADA','ANULADA')\nORDER BY DiasEnProceso DESC",
      rowCount: 6,
      data: [
        { NroCarpeta: 'IMP-2024-0891', Proveedor: 'Maschinenbau GmbH',      PaisOrigen: 'Alemania', MontoFOB_USD: 185000, EstadoCarpeta: 'En Aduana',  DiasEnProceso: 67 },
        { NroCarpeta: 'IMP-2025-0012', Proveedor: 'Steel Corp S.A.',        PaisOrigen: 'Brasil',   MontoFOB_USD:  92400, EstadoCarpeta: 'En Tránsito', DiasEnProceso: 41 },
        { NroCarpeta: 'IMP-2025-0034', Proveedor: 'Chemical Products Ltd',  PaisOrigen: 'EE.UU.',  MontoFOB_USD:  67800, EstadoCarpeta: 'En Aduana',  DiasEnProceso: 38 },
        { NroCarpeta: 'IMP-2025-0051', Proveedor: 'Asian Manufacturing Co', PaisOrigen: 'China',    MontoFOB_USD: 234500, EstadoCarpeta: 'En Tránsito', DiasEnProceso: 28 },
        { NroCarpeta: 'IMP-2025-0067', Proveedor: 'Aceros Monterrey S.A.',  PaisOrigen: 'México',   MontoFOB_USD:  45200, EstadoCarpeta: 'Abierta',    DiasEnProceso: 15 },
        { NroCarpeta: 'IMP-2025-0078', Proveedor: 'Euro Parts GmbH',        PaisOrigen: 'Alemania', MontoFOB_USD: 128900, EstadoCarpeta: 'Abierta',    DiasEnProceso:  8 },
      ],
      columns: [
        { key: 'NroCarpeta',    label: 'N° Carpeta',      type: 'string',  align: 'left'  },
        { key: 'Proveedor',     label: 'Proveedor',        type: 'string',  align: 'left'  },
        { key: 'PaisOrigen',    label: 'País',             type: 'string',  align: 'left'  },
        { key: 'MontoFOB_USD',  label: 'FOB (USD)',        type: 'currency', align: 'right' },
        { key: 'EstadoCarpeta', label: 'Estado',           type: 'string',  align: 'left'  },
        { key: 'DiasEnProceso', label: 'Días en Proceso',  type: 'number',  align: 'right' },
      ],
      chartConfig: undefined,
    },
    followUps: [
      '¿Cuánto suman los gastos de internación de las carpetas en aduana?',
      '¿Qué carpetas de importación se cerraron este mes y cuál fue su costo final?',
      '¿Cuál es el tiempo promedio de despacho por país de origen?',
    ],
  },
};
