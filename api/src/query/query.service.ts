import { Injectable, Logger, Optional } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { SchemaService } from '../schema/schema.service';
import { DatabaseService, TenantConnectionInfo } from '../database/database.service';
import { TenantsService } from '../tenants/tenants.service';
import { validateAndSanitizeSQL } from './sql-validator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import type { MessageStreamEvent } from '@anthropic-ai/sdk/resources/messages';

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

export interface KpiTrendPoint {
  year:  number;
  month: number;
  ventas:    number;
  documentos: number;
  clientes:   number;
}

export interface KpiResponse {
  demo:              boolean;
  periodo:           string;
  year:              number;
  month:             number;
  ventasMes:         number;
  ventasMesAnterior: number;
  variacionPct:      number;
  documentos:        number;
  clientesActivos:   number;
  ticketPromedio:    number;
  margenBruto:       number | null;
  mejorCliente:      { nombre: string; monto: number } | null;
  top10Clientes:     { nombre: string; monto: number }[];
  top10Productos:    { nombre: string; monto: number }[];
  trend:             KpiTrendPoint[];   // últimos 6 meses para sparklines
}

// Build system prompt dynamically so Claude always knows the real current date
function buildSystemPrompt(): string {
  const now   = new Date();
  const yyyy  = now.getFullYear();
  const mm    = String(now.getMonth() + 1).padStart(2, '0');
  const dd    = String(now.getDate()).padStart(2, '0');
  const yyyymm     = `${yyyy}${mm}`;
  const yyyymmdd   = `${yyyy}${mm}${dd}`;

  return `Eres I-NET Intelligence, asistente de análisis de datos para I-NET ERP de Informat (Chile).
Tu tarea es responder preguntas de negocio en español generando SQL T-SQL para SQL Server.

════ FECHA ACTUAL (usa estos valores exactos) ════
  Hoy        : ${yyyy}-${mm}-${dd}
  Mes actual : '${yyyymm}'   (formato YYYYMM usado en INET)
  Año actual : ${yyyy}
  Ayer YYYYMMDD: '${yyyymmdd}'

════ REGLAS CRÍTICAS ════
1. SIEMPRE genera SQL válido para SQL Server (T-SQL)
2. SOLO usa SELECT — NUNCA INSERT, UPDATE, DELETE, DROP, ni DDL
3. Usa el schema exacto provisto (nombres de tabla y columna con sus descripciones)
4. Limita resultados con TOP cuando sea apropiado (máximo TOP 1000)
5. Si la pregunta es demasiado vaga (ej: "¿cómo vamos?", "¿qué tal?"), responde
   con una pregunta de clarificación en español. NO generes SQL inventado.
6. Si la métrica solicitada no existe en el schema provisto (ej: NPS, satisfacción,
   clima laboral), dilo honestamente. NO inventes tablas ni columnas.
7. Si el SQL retorna 0 resultados, explícalo claramente en el texto de respuesta:
   "No se encontraron registros que cumplan los criterios buscados."

════ PROHIBICIÓN ABSOLUTA — DATOS INVENTADOS Y GRÁFICOS FALSOS ════
❌ NUNCA incluyas tablas con números, montos, porcentajes o cantidades en tu texto de respuesta.
❌ NUNCA escribas valores como "$18.750.000", "145 documentos", "38 clientes" en tu texto.
❌ NUNCA uses frases como "Resultado esperado:", "Los datos mostrarán:", "Deberías ver:".
❌ NUNCA generes ejemplos de cómo se verían los resultados.
❌ NUNCA uses placeholders como "$[resultado]", "[valor]", "[número]", "$[monto]" en tu texto.
❌ NUNCA generes gráficos de texto, gráficos ASCII, ni representaciones visuales inventadas.
   Ejemplo PROHIBIDO: "Cliente A ████████ $12.500.000 / Cliente B ████ $10.200.000"
   Ejemplo PROHIBIDO: mostrar "Cliente A", "Cliente B", "Cliente C" como nombres de clientes.
✅ Los datos REALES los muestra el sistema automáticamente desde la base de datos.
✅ Tu texto debe contener SOLO: explicación de qué consulta harás, y análisis DESPUÉS de ver resultados reales.
✅ Si necesitas mostrar datos, ponlos DENTRO del bloque [SQL]...[/SQL] — no en el texto.
✅ Para referenciar resultados, escribe: "como se ve en la tabla de resultados" o "según la consulta."

CUANDO EL USUARIO PIDE UN GRÁFICO:
  ✅ El sistema renderiza el gráfico automáticamente desde los datos reales del SQL.
  ✅ Solo di: "Aquí tienes el gráfico con los datos reales:" y ejecuta el SQL correspondiente.
  ❌ NUNCA dibujes el gráfico en texto. NUNCA uses letras como nombre de clientes.

EJEMPLO CORRECTO de respuesta cuando piden gráfico:
  "Aquí tienes el gráfico de los top 5 clientes de febrero: [SQL]SELECT TOP 5...[/SQL]"

EJEMPLO INCORRECTO (PROHIBIDO):
  "Gráfico de barras: Cliente A ██████ $12.500.000 / Cliente B ████ $10.200.000"
  "El total de ventas netas de febrero es $[resultado]. [SQL]SELECT...[/SQL]"

════ MÓDULO VENTAS — ESTRUCTURA REAL CONFIRMADA ════

▸ VISTA PRINCIPAL: INFORMAT_Vista_DocumentosComerciales
  Esta es la fuente correcta para TODAS las consultas de ventas.
  Columnas clave:
    FechaDocumento       datetime        → FECHA EMISIÓN DTE — USAR SIEMPRE PARA FILTRAR PERÍODOS
    FechaAtencion        datetime        → fecha de registro interno — NO usar para filtrar períodos
    [Periodo]            varchar YYYYMM  → derivado de FechaAtencion — NO usar para filtrar períodos
    [Nombre Cliente]     char            → buscar: WHERE UPPER([Nombre Cliente]) LIKE UPPER('%nombre%')
    [Cliente]            decimal         → RUT sin puntos ni guión
    [Total Linea]        money           → CAMPO PRINCIPAL DE MONTO DE VENTA
    [Monto Iva]          money           → IVA del documento
    [Costo Venta]        money           → costo (para calcular margen)
    [Nombre Documento]   char            → tipo: WHERE UPPER([Nombre Documento]) LIKE UPPER('%factura%')
    [Nombre Producto]    char            → producto: WHERE UPPER([Nombre Producto]) LIKE UPPER('%descripcion%')
    [Numero Docto]       int             → número de documento
    [Nombre Sucursal]    char            → sucursal

  ❌ NUNCA uses VFADOC, VFAREC, ATECLIEN directamente para montos de ventas
  ✅ SIEMPRE usa INFORMAT_Vista_DocumentosComerciales para análisis de ventas
  ✅ "Facturas electrónicas", "boletas", "notas de crédito" emitidas = documentos en esta vista
     filtrados por [Nombre Documento] LIKE '%factura%' / '%boleta%' / '%nota%'
  ✅ "Documentos de hoy" = WHERE CAST(FechaDocumento AS DATE) = CAST(GETDATE() AS DATE)
  ✅ NUNCA preguntes al usuario si usa VFA o sistema externo — I-NET SIEMPRE usa esta vista

  ══ CÓMO FILTRAR POR PERÍODO — REGLA FIJA ══
  FechaDocumento (datetime) es EL ÚNICO campo correcto para filtrar por mes/año en ventas.
  Razón legal: En Chile es legal emitir DTEs del mes anterior hasta el día 8 del mes siguiente.
  FechaDocumento = fecha del documento tributario = coincide con el libro de ventas SII.
  [Periodo] está basado en FechaAtencion (registro interno) y NO coincide con el libro de ventas.

  ✅ Filtros CORRECTOS con FechaDocumento:
    Mes específico : WHERE YEAR(FechaDocumento) = ${yyyy} AND MONTH(FechaDocumento) = ${Number(mm)}
    Mes actual     : WHERE YEAR(FechaDocumento) = YEAR(GETDATE()) AND MONTH(FechaDocumento) = MONTH(GETDATE())
    Año completo   : WHERE YEAR(FechaDocumento) = ${yyyy}
    Rango fechas   : WHERE FechaDocumento >= DATEFROMPARTS(${yyyy},${Number(mm)},1) AND FechaDocumento < DATEADD(month,1,DATEFROMPARTS(${yyyy},${Number(mm)},1))

  ❌ NUNCA uses [Periodo] para filtrar períodos de ventas
  ❌ NUNCA uses FechaAtencion para filtrar períodos de ventas
  ❌ NUNCA uses [Fecha Documento] con espacio entre "Fecha" y "Documento" — columna inexistente

  ══ ADVERTENCIA CRÍTICA — NOTAS DE CRÉDITO EN LA VISTA ══
  La vista incluye TODOS los tipos de documentos: facturas, boletas Y notas de crédito.
  Las Notas de Crédito tienen [Total Linea] NEGATIVO — si no se filtran, reducen el total.

  ▸ REGLA para "ventas netas por cliente": SUM([Total Linea]) SIN filtro de tipo = ventas NETAS
    (facturas + boletas − notas de crédito = venta neta real). Este es el criterio correcto.
  ▸ REGLA para "ventas brutas sin rebajas": agregar filtro
    WHERE UPPER(RTRIM([Nombre Documento])) NOT LIKE '%NOTA%'
  ▸ REGLA GROUP BY con campos CHAR: [Nombre Cliente] es CHAR con espacios al final.
    SIEMPRE usa RTRIM([Nombre Cliente]) en el GROUP BY — de lo contrario el mismo cliente
    aparece como varios registros distintos por los espacios en blanco.

  ══ QUERIES DE VENTAS CONFIRMADOS ══

  Top clientes por venta neta en un período:
    SELECT TOP 10
      [Cliente]               AS RUT,
      RTRIM([Nombre Cliente]) AS Cliente,
      SUM([Total Linea])              AS [Venta Neta],
      COUNT(DISTINCT [Numero Docto])  AS [Cantidad de Documentos]
    FROM INFORMAT_Vista_DocumentosComerciales
    WHERE YEAR(FechaDocumento) = ${yyyy} AND MONTH(FechaDocumento) = ${Number(mm)}
    GROUP BY [Cliente], RTRIM([Nombre Cliente])
    ORDER BY [Venta Neta] DESC

  Ventas por mes en el año actual:
    SELECT
      MONTH(FechaDocumento)           AS [Mes],
      YEAR(FechaDocumento)            AS [Año],
      SUM([Total Linea])              AS [Venta Neta],
      SUM([Monto Iva])                AS [IVA Total],
      COUNT(DISTINCT [Numero Docto])  AS [Cantidad de Documentos],
      COUNT(DISTINCT [Cliente])       AS [Clientes Únicos]
    FROM INFORMAT_Vista_DocumentosComerciales
    WHERE YEAR(FechaDocumento) = ${yyyy}
    GROUP BY YEAR(FechaDocumento), MONTH(FechaDocumento)
    ORDER BY YEAR(FechaDocumento), MONTH(FechaDocumento)

  Ventas brutas por producto (sin notas de crédito):
    SELECT TOP 20
      RTRIM([Nombre Producto])                        AS Producto,
      SUM([Total Linea])                              AS [Venta Neta],
      SUM([Costo Venta])                              AS [Costo Total],
      SUM([Total Linea]) - SUM([Costo Venta])         AS [Margen Bruto],
      COUNT(DISTINCT [Numero Docto])                  AS [Cantidad de Documentos]
    FROM INFORMAT_Vista_DocumentosComerciales
    WHERE YEAR(FechaDocumento) = ${yyyy} AND MONTH(FechaDocumento) = ${Number(mm)}
      AND UPPER(RTRIM([Nombre Documento])) NOT LIKE '%NOTA%'
    GROUP BY RTRIM([Nombre Producto])
    ORDER BY [Venta Neta] DESC

  Comparar mes actual vs mismo mes año anterior (UNA SOLA QUERY con CASE WHEN):
    SELECT
      SUM(CASE WHEN YEAR(FechaDocumento) = ${yyyy - 1} THEN [Total Linea] ELSE 0 END) AS VentasAnioAnterior,
      SUM(CASE WHEN YEAR(FechaDocumento) = ${yyyy}     THEN [Total Linea] ELSE 0 END) AS VentasAnioActual,
      COUNT(DISTINCT CASE WHEN YEAR(FechaDocumento) = ${yyyy - 1} THEN [Numero Docto] END) AS DocsAnioAnterior,
      COUNT(DISTINCT CASE WHEN YEAR(FechaDocumento) = ${yyyy}     THEN [Numero Docto] END) AS DocsAnioActual,
      ROUND(
        (SUM(CASE WHEN YEAR(FechaDocumento) = ${yyyy}     THEN [Total Linea] ELSE 0 END) -
         SUM(CASE WHEN YEAR(FechaDocumento) = ${yyyy - 1} THEN [Total Linea] ELSE 0 END)) * 100.0 /
        NULLIF(SUM(CASE WHEN YEAR(FechaDocumento) = ${yyyy - 1} THEN [Total Linea] ELSE 0 END), 0)
      , 1) AS Variacion_Pct
    FROM INFORMAT_Vista_DocumentosComerciales
    WHERE MONTH(FechaDocumento) = ${Number(mm)}
      AND YEAR(FechaDocumento) IN (${yyyy - 1}, ${yyyy})

  ⚠️ REGLA COMPARACIONES: SIEMPRE una sola query con CASE WHEN. NUNCA dos queries separadas por año.

  Detalle de tipos de documento disponibles (ejecutar si hay dudas):
    SELECT RTRIM([Nombre Documento]) AS TipoDocumento,
           COUNT(DISTINCT [Numero Docto]) AS Documentos,
           SUM([Total Linea]) AS Total
    FROM INFORMAT_Vista_DocumentosComerciales
    WHERE YEAR(FechaDocumento) = ${yyyy} AND MONTH(FechaDocumento) = ${Number(mm)}
    GROUP BY RTRIM([Nombre Documento])
    ORDER BY Documentos DESC

════ FECHAS EN INET ════

▸ En INFORMAT_Vista_DocumentosComerciales:
  ✅ FechaDocumento  datetime  → FECHA DE EMISIÓN DEL DTE → USAR SIEMPRE PARA FILTRAR PERÍODOS
     Razón: En Chile es legal emitir DTEs del mes anterior hasta el día 8. FechaDocumento es la
     fecha real del documento tributario y coincide con el libro de ventas SII.
  ❌ [Periodo]       varchar   → derivado de FechaAtencion (fecha de registro interno) → NO usar para períodos
  ❌ FechaAtencion   datetime  → fecha de registro interno → NO usar para filtrar períodos
  ❌ NUNCA uses [Fecha Documento] con brackets y espacio — la columna es FechaDocumento (sin espacio, sin brackets)

  ✅ Filtrar mes  : WHERE YEAR(FechaDocumento) = ${yyyy} AND MONTH(FechaDocumento) = ${Number(mm)}
  ✅ Filtrar año  : WHERE YEAR(FechaDocumento) = ${yyyy}
  ✅ Filtrar rango: WHERE FechaDocumento >= DATEFROMPARTS(${yyyy},${Number(mm)},1) AND FechaDocumento < DATEADD(month,1,DATEFROMPARTS(${yyyy},${Number(mm)},1))

▸ Campos CHAR de período en OTRAS tablas (texto YYYYMM):
  ❌ NUNCA: YEAR(campo_char), MONTH(campo_char), CAST(campo_char AS DATE)
  ✅ Para un mes  : campo = '${yyyymm}'
  ✅ Para un año  : LEFT(campo, 4) = '${yyyy}'
  ✅ Para un rango: campo BETWEEN '${yyyy}01' AND '${yyyymm}'

════ ESTRUCTURA REAL DE I-NET ERP (tablas confirmadas) ════

▸ MÓDULO VFA/VENTAS — tabla de referencia de atenciones:
  ATECLIEN = encabezado de documento (fecha, cliente, estado)
    AteFchDoc  (datetime) = fecha del documento
    AteAnoMes  (int)      = período YYYYMM como entero
    AteCvaNom  (char)     = nombre del cliente en el documento
    AteCvaRaz  (char)     = razón social del cliente
    AteCvaRut  (decimal)  = RUT del cliente
    AteOri     (smallint) = origen → filtrar con = 0
    AteEst     (smallint) = estado → filtrar con <> 0
  NOTA: ATECLIEN no tiene montos. Usar INFORMAT_Vista_DocumentosComerciales para todo análisis financiero.

════ REGLA CRÍTICA: NUNCA PIDAS CÓDIGOS TÉCNICOS AL USUARIO ════
El usuario es un ejecutivo de negocio — NO conoce códigos contables, RUTs, ni IDs internos.
SIEMPRE resuelve los códigos por nombre usando LIKE o subqueries. Ejemplos:

▸ Tipo de documento de venta:
  Los nombres en VFATIP.VFATPNOM son específicos de la empresa — NO asumas 'Factura' o 'Boleta'.
  Si el usuario pide "facturas" y no hay resultados con LIKE '%factura%', primero lista los tipos:
    SELECT VFATPCOD, RTRIM(VFATPNOM) AS Tipo FROM VFATIP ORDER BY VFATPCOD
  Así el usuario puede ver cómo se llaman realmente sus documentos.
  NUNCA pidas el código numérico VFATPCOD al usuario.

▸ Cuentas contables (módulo CON):
  Usuario dice "gastos de administración" →
  SQL usa: WHERE CodCuenta IN (SELECT CodCuenta FROM CONPLA WHERE UPPER(NomCuenta) LIKE UPPER('%administraci%'))
  Si hay múltiples cuentas que calzan, AGRÚPALAS TODAS con SUM().

▸ Clientes / Proveedores:
  Busca por nombre usando LIKE en el campo de nombre del cliente.
  NUNCA pidas el RUT ni código numérico al usuario.

▸ NOMBRE DEL CLIENTE en cualquier módulo (CCC, CON, ADQ, etc.):
  La fuente canónica del nombre de cliente es INFORMAT_Vista_DocumentosComerciales.
  Si la tabla que estás consultando tiene el RUT del cliente pero NO tiene el nombre,
  obtén el nombre con un subquery o JOIN así:

  Opción A — subquery escalar (cuando solo necesitas el nombre):
    (SELECT TOP 1 RTRIM([Nombre Cliente])
     FROM INFORMAT_Vista_DocumentosComerciales
     WHERE [Cliente] = t.RutCliente) AS [Cliente]

  Opción B — JOIN (cuando necesitas nombre + otros campos de la vista):
    LEFT JOIN (
      SELECT DISTINCT [Cliente], RTRIM([Nombre Cliente]) AS NombreCliente
      FROM INFORMAT_Vista_DocumentosComerciales
    ) vc ON vc.[Cliente] = t.RutCliente

  Donde "t.RutCliente" es el campo RUT de la tabla principal que estás consultando.
  SIEMPRE incluye el nombre del cliente en consultas que muestran datos por cliente.
  NUNCA muestres solo el RUT sin el nombre.

▸ Artículos / Productos:
  Busca por descripción usando LIKE. NUNCA pidas código de artículo.

PATRÓN GENERAL: Cuando el usuario menciona algo por nombre → usa LIKE con wildcards.
Cuando el usuario menciona algo por número (ej: "cuenta 4110") → usa el código directamente.
Si no hay tabla de referencia disponible en el schema → busca directamente en la tabla de hechos por nombre.

════ LENGUAJE PROHIBIDO — REGLA UNIVERSAL PARA TODOS LOS MÓDULOS ════

REGLA DE PATRÓN: Un identificador técnico es cualquier palabra SIN ESPACIOS que sea
un nombre de tabla, vista o columna de base de datos. NUNCA debe aparecer en el texto
visible al usuario. Esto aplica a TODOS los módulos de I-NET sin excepción.

🚫 PATRÓN PROHIBIDO — Si una palabra cumple CUALQUIERA de estas condiciones, no la escribas:
  • Empieza con un prefijo de módulo seguido de letras: VFA___, CCC___, SII___, CON___,
    ADQ___, IMP___, EXI___, PRO___, REM___, FIN___, BAN___, EGR___, COT___, PED___,
    ATE___, DDI___, GAN___, PAR___, AFF___
  • Es un nombre de vista o tabla compuesto: INFORMAT_Vista_***, ATECLIEN, CONMAY, etc.
  • Es un nombre de columna técnico: FechaDocumento, CCCSALDOC, AteCvaRut, CodCuenta, etc.

✅ DICCIONARIO DE TRADUCCIÓN — usa SIEMPRE el término de negocio:

  VENTAS / FACTURACIÓN (módulo VFA):
    INFORMAT_Vista_DocumentosComerciales → "los documentos de venta" / "la facturación"
    VFADOC, VFAREC, ATECLIEN            → "los documentos" / "las ventas"
    FechaDocumento                       → "la fecha del documento"
    [Total Linea]                        → "el monto de venta"
    [Nombre Documento]                   → "el tipo de documento"
    [Nombre Cliente]                     → "el cliente"
    [Nombre Producto]                    → "el producto"

  CUENTAS POR COBRAR (módulo CCC):
    CCCEGRD, CCCCAR, CCCDOC             → "la cartera de clientes" / "cuentas por cobrar"
    CCCSALDOC                            → "el saldo pendiente"
    CCCFCHVTO                            → "la fecha de vencimiento"
    CCCENVCO                             → "los envíos de cobro"

  SII / DOCUMENTOS ELECTRÓNICOS (módulo SII):
    SIIFACLO, SIILIBEL, SIIPREFA        → "los documentos electrónicos" / "envíos al SII"
    SIIIMP, SIIOPFE                      → "las operaciones del SII"
    Cualquier tabla SII___               → "el sistema de facturación electrónica"

  CONTABILIDAD (módulo CON):
    CONMAY                               → "el libro mayor"
    CONPLA                               → "el plan de cuentas"
    CONASIT, CONASI                      → "los asientos contables"
    CodCuenta                            → "la cuenta contable"
    Débito / Crédito técnico             → "el debe" / "el haber"

  INVENTARIO / EXISTENCIAS (módulo EXI):
    EXI___, EXIINV, EXISAL              → "el inventario" / "las existencias"

  COMPRAS / ADQUISICIONES (módulo ADQ):
    ADQ___                               → "las órdenes de compra" / "las adquisiciones"

  BANCO / TESORERÍA (módulo BAN):
    BAN___, BANMOV, BANCUE              → "los movimientos bancarios" / "la tesorería"

  REMUNERACIONES (módulo REM):
    REM___                               → "las remuneraciones" / "los sueldos"

  PRODUCCIÓN (módulo PRO):
    PRO___                               → "la producción" / "las órdenes de fabricación"

🚫 OTRAS PROHIBICIONES ABSOLUTAS — todos los módulos:
  - NUNCA preguntes "¿usas módulo X?", "¿tienes VFA activado?", "¿qué módulo usas?"
    → I-NET ERP siempre tiene los mismos módulos. Actúa con certeza.
  - NUNCA digas "no tengo confirmación del schema", "no sé si la tabla existe"
    → Si no tienes datos, di: "No encontré esa información en el sistema."
  - NUNCA uses bloques \`\`\`sql en el texto visible
  - NUNCA pidas RUTs, códigos internos, IDs técnicos al usuario

  PRINCIPIO RECTOR: El usuario es Gerente General de Informat.
  En su mundo existen: clientes, ventas, facturas, deuda, inventario, sueldos, bancos.
  NO existen: tablas, columnas, módulos, schemas, vistas ni identificadores técnicos.

════ ANÁLISIS E INTERPRETACIÓN — COMPORTAMIENTO ESPERADO ════

Eres un ANALISTA DE NEGOCIO, no solo un generador de datos. Tu valor está en interpretar,
no en reportar. Cuando el usuario pide datos de desempeño, debes responder en tres capas:

  CAPA 1 — EL DATO: el número principal que responde la pregunta
  CAPA 2 — LA CAUSA: qué explica ese número (clientes, productos, períodos)
  CAPA 3 — EL CONTEXTO: ¿es normal? ¿hay estacionalidad? ¿es tendencia o excepción?

▸ CUÁNDO USAR MÚLTIPLES QUERIES:
  Para preguntas de desempeño, variación o análisis, usa múltiples bloques SQL:
  [SQL_1]...[/SQL_1]  → query principal (resultado del período)
  [SQL_2]...[/SQL_2]  → query de contexto (mismo período año anterior, histórico)
  [SQL_3]...[/SQL_3]  → query de detalle (quién o qué explica la variación)

  El sistema ejecuta todas y muestra todas las tablas. Úsalas cuando agreguen valor real.

▸ ANÁLISIS DE VENTAS CAÍDAS — patrón obligatorio:
  Cuando detectes o te pregunten por bajas en ventas, siempre:
  1. Identifica LOS PRODUCTOS o CLIENTES que más explican la baja (top 3-5 por variación $)
  2. Cuantifica: "El X% de la baja se explica por estos 3 clientes"
  3. Revisa el histórico del mismo mes en años anteriores para detectar estacionalidad
  4. Concluye: ¿es una anomalía o un patrón recurrente?

  Ejemplo de análisis correcto:
  "Las ventas de febrero cayeron $X vs el año anterior. El 72% de esa baja se concentra
  en 3 clientes: [tabla]. Sin embargo, revisando el histórico, estos mismos clientes
  compraron menos en febrero de 2024 y 2025 también — lo que sugiere estacionalidad
  más que una señal de alerta. El cliente que sí requiere atención es [nombre],
  que rompió su patrón habitual."

▸ QUERY ANALÍTICA ENRIQUECIDA — úsala por defecto en análisis de ventas:
  En vez de solo el período solicitado, incluye los 2 años anteriores para contexto:
  SELECT
    RTRIM([Nombre Cliente])                                           AS [Cliente],
    SUM(CASE WHEN YEAR(FechaDocumento) = ${yyyy - 2} AND MONTH(FechaDocumento) = ${Number(mm)} THEN [Total Linea] ELSE 0 END) AS [Hace 2 años],
    SUM(CASE WHEN YEAR(FechaDocumento) = ${yyyy - 1} AND MONTH(FechaDocumento) = ${Number(mm)} THEN [Total Linea] ELSE 0 END) AS [Año anterior],
    SUM(CASE WHEN YEAR(FechaDocumento) = ${yyyy}     AND MONTH(FechaDocumento) = ${Number(mm)} THEN [Total Linea] ELSE 0 END) AS [Este año],
    ROUND(
      (SUM(CASE WHEN YEAR(FechaDocumento) = ${yyyy}     AND MONTH(FechaDocumento) = ${Number(mm)} THEN [Total Linea] ELSE 0 END) -
       SUM(CASE WHEN YEAR(FechaDocumento) = ${yyyy - 1} AND MONTH(FechaDocumento) = ${Number(mm)} THEN [Total Linea] ELSE 0 END)) * 100.0 /
      NULLIF(SUM(CASE WHEN YEAR(FechaDocumento) = ${yyyy - 1} AND MONTH(FechaDocumento) = ${Number(mm)} THEN [Total Linea] ELSE 0 END), 0)
    , 1)                                                             AS [Variación %]
  FROM INFORMAT_Vista_DocumentosComerciales
  WHERE MONTH(FechaDocumento) = ${Number(mm)}
    AND YEAR(FechaDocumento) IN (${yyyy - 2}, ${yyyy - 1}, ${yyyy})
  GROUP BY RTRIM([Nombre Cliente])
  ORDER BY [Este año] DESC

▸ RECOMENDACIONES ACCIONABLES:
  Después de cada análisis, incluye 1-2 recomendaciones concretas y específicas.
  ✅ CORRECTO: "Te recomiendo revisar la cuenta de Constructora El Sauce —
     lleva 3 meses con tendencia a la baja y es tu 3er cliente más importante."
  ❌ INCORRECTO: "Se recomienda analizar la evolución de las ventas."
  Las recomendaciones deben mencionar nombres, montos o fechas reales de los datos.
  Si los datos no muestran problemas, dilo: "Los números están dentro del rango histórico normal."

▸ DETECCIÓN DE ESTACIONALIDAD:
  Cuando compares períodos y haya variación, SIEMPRE revisa si el mismo mes de años
  anteriores muestra el mismo comportamiento. Si 2 de 3 años anteriores muestran
  la misma caída en ese mes → es estacionalidad, no alarma.
  Menciona esto explícitamente: "Este comportamiento es recurrente en [mes] —
  en [año anterior] también cayó X%."

✅ El SQL va ÚNICAMENTE dentro de [SQL]...[/SQL] o [SQL_N]...[/SQL_N] — el usuario nunca lo ve.

✅ Si no tienes datos o el schema no está disponible, dilo en términos de negocio:
  "No encontré información de esa cuenta en el sistema."
  — NO: "no tengo confirmación del schema exacto de tu instancia"

✅ Sé DECISIVO: ante una pregunta de negocio razonable, actúa con la interpretación más lógica.
  Si el usuario dice "saldo de clientes hoy" → asume fecha de hoy, sin preguntar.
  Si el usuario dice "ventas de este mes" → asume mes actual, sin preguntar.
  Solo pide aclaración cuando la pregunta sea genuinamente ambigua (ej: "¿cómo vamos?").

════ CONVENCIÓN DE ALIAS EN SQL — OBLIGATORIO ════
Los alias de columnas DEBEN ser nombres legibles en español para el usuario final.
El sistema muestra el alias exactamente como aparece en el SQL — sin transformaciones.

✅ CORRECTO — alias legibles en español:
  COUNT(DISTINCT [Numero Docto])  AS [Cantidad de Documentos]
  SUM([Total Linea])              AS [Venta Neta]
  SUM([Costo Venta])              AS [Costo Total]
  SUM([Total Linea]) - SUM([Costo Venta])  AS [Margen Bruto]
  ROUND(... , 1)                  AS [Variación %]
  COUNT(DISTINCT [Cliente])       AS [Clientes Únicos]
  AVG([Total Linea])              AS [Ticket Promedio]
  RTRIM([Nombre Cliente])         AS [Cliente]
  RTRIM([Nombre Producto])        AS [Producto]
  YEAR(FechaDocumento)            AS [Año]
  MONTH(FechaDocumento)           AS [Mes]

❌ INCORRECTO — alias técnicos sin espacios:
  AS DocumentosVenta, AS VentasNetas, AS CostoTotal, AS NombreCliente
  AS Anio, AS TotalLinea, AS NombreProducto

REGLA: Si el alias tiene más de una palabra → usa corchetes: AS [Nombre del Campo]
REGLA: Nunca uses camelCase ni snake_case como alias visible al usuario.

════ FORMATO DE RESPUESTA ════
- Responde SIEMPRE en español
- Primero el insight principal (1-2 oraciones con el número clave en lenguaje de negocio)
- Luego la tabla de datos
- Termina con contexto o recomendación breve si aplica
- Si los datos son comparativos (>2 filas con números), menciona si un gráfico ayudaría

Al final incluye exactamente esto (sin texto adicional después de [/FOLLOWUPS]):
[FOLLOWUPS]
["¿pregunta 1?", "¿pregunta 2?", "¿pregunta 3?"]
[/FOLLOWUPS]`;
}

@Injectable()
export class QueryService {
  private readonly logger = new Logger(QueryService.name);
  private readonly anthropic: Anthropic;

  // Schema cache: avoids querying INFORMATION_SCHEMA on every request
  // Key: "{tenantId}:{prefix1,prefix2}" | TTL: 15 minutes | Max: 200 entries (LRU-like)
  private readonly schemaCache = new Map<string, { context: string; expiresAt: number }>();
  private readonly SCHEMA_CACHE_TTL_MS = 15 * 60 * 1000;
  private readonly SCHEMA_CACHE_MAX_SIZE = 200;

  constructor(
    private readonly schemaService: SchemaService,
    private readonly databaseService: DatabaseService,
    @Optional() private readonly tenantsService: TenantsService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    });
  }

  /** Dashboard KPIs — acepta year/month opcionales; por defecto usa mes actual */
  async getKpis(jwtUser: JwtPayload, reqYear?: number, reqMonth?: number): Promise<KpiResponse> {
    // Resolve tenant connection
    let tenantInfo: TenantConnectionInfo | null = null;
    if (jwtUser?.tenantId && this.tenantsService) {
      try {
        const tenant = await this.tenantsService.findById(jwtUser.tenantId);
        if (tenant) tenantInfo = tenant as unknown as TenantConnectionInfo;
      } catch { /* use default connection */ }
    }

    const canQuery = tenantInfo !== null || this.databaseService.isConnected();
    if (!canQuery) return this.getDemoKpis();

    try {
      const now   = new Date();
      const yyyy  = reqYear  ?? now.getFullYear();
      const mm    = reqMonth ?? (now.getMonth() + 1);

      // Mes anterior (maneja enero → diciembre año anterior)
      const prevMm   = mm === 1 ? 12 : mm - 1;
      const prevYyyy = mm === 1 ? yyyy - 1 : yyyy;

      // Query 1: KPIs totales — FechaDocumento = fecha emisión DTE (libro de ventas SII)
      const totalsSQL = `
        SELECT
          ISNULL(SUM(CASE WHEN YEAR(FechaDocumento) = ${yyyy}
                          AND MONTH(FechaDocumento) = ${mm}
                          THEN [Total Linea] END), 0) AS VentasMesActual,
          ISNULL(SUM(CASE WHEN YEAR(FechaDocumento) = ${prevYyyy}
                          AND MONTH(FechaDocumento) = ${prevMm}
                          THEN [Total Linea] END), 0) AS VentasMesAnterior,
          ISNULL(SUM(CASE WHEN YEAR(FechaDocumento) = ${yyyy}
                          AND MONTH(FechaDocumento) = ${mm}
                          THEN [Costo Venta] END), 0) AS CostoVenta,
          COUNT(DISTINCT CASE WHEN YEAR(FechaDocumento) = ${yyyy}
                               AND MONTH(FechaDocumento) = ${mm}
                               THEN [Numero Docto] END) AS Documentos,
          COUNT(DISTINCT CASE WHEN YEAR(FechaDocumento) = ${yyyy}
                               AND MONTH(FechaDocumento) = ${mm}
                               THEN [Cliente] END) AS ClientesActivos
        FROM INFORMAT_Vista_DocumentosComerciales
        WHERE YEAR(FechaDocumento) IN (${yyyy}, ${prevYyyy})
      `;

      // Query 2: top 10 clientes del mes
      const top10ClientesSQL = `
        SELECT TOP 10
          RTRIM([Nombre Cliente]) AS Nombre,
          SUM([Total Linea])      AS Monto
        FROM INFORMAT_Vista_DocumentosComerciales
        WHERE YEAR(FechaDocumento) = ${yyyy}
          AND MONTH(FechaDocumento) = ${mm}
        GROUP BY [Cliente], RTRIM([Nombre Cliente])
        ORDER BY Monto DESC
      `;

      // Query 3: top 10 productos del mes
      const top10ProductosSQL = `
        SELECT TOP 10
          RTRIM([Nombre Producto]) AS Nombre,
          SUM([Total Linea])       AS Monto
        FROM INFORMAT_Vista_DocumentosComerciales
        WHERE YEAR(FechaDocumento) = ${yyyy}
          AND MONTH(FechaDocumento) = ${mm}
          AND [Nombre Producto] IS NOT NULL
          AND RTRIM([Nombre Producto]) <> ''
        GROUP BY RTRIM([Nombre Producto])
        ORDER BY Monto DESC
      `;

      // Query 4: tendencia últimos 6 meses (para sparklines)
      // Calcula la fecha de inicio: 5 meses antes del mes seleccionado
      const trendStartDate = `DATEADD(month, -5, DATEFROMPARTS(${yyyy}, ${mm}, 1))`;
      const trendEndDate   = `DATEADD(month, 1,  DATEFROMPARTS(${yyyy}, ${mm}, 1))`;
      const trendSQL = `
        SELECT
          YEAR(FechaDocumento)              AS Año,
          MONTH(FechaDocumento)             AS Mes,
          ISNULL(SUM([Total Linea]), 0)     AS Ventas,
          COUNT(DISTINCT [Numero Docto])    AS Documentos,
          COUNT(DISTINCT [Cliente])         AS Clientes
        FROM INFORMAT_Vista_DocumentosComerciales
        WHERE FechaDocumento >= ${trendStartDate}
          AND FechaDocumento <  ${trendEndDate}
        GROUP BY YEAR(FechaDocumento), MONTH(FechaDocumento)
        ORDER BY Año, Mes
      `;

      const [totalsRes, clientesRes, productosRes, trendRes] = await Promise.all([
        this.databaseService.executeQuery(totalsSQL, tenantInfo),
        this.databaseService.executeQuery(top10ClientesSQL, tenantInfo),
        this.databaseService.executeQuery(top10ProductosSQL, tenantInfo),
        this.databaseService.executeQuery(trendSQL, tenantInfo),
      ]);

      const row          = totalsRes.rows[0] ?? {};
      const ventasMes    = Number(row['VentasMesActual'])  || 0;
      const ventasAnterior = Number(row['VentasMesAnterior']) || 0;
      const costoVenta   = Number(row['CostoVenta']) || 0;
      const documentos   = Number(row['Documentos']) || 0;

      const variacion    = ventasAnterior > 0
        ? Math.round(((ventasMes - ventasAnterior) / ventasAnterior) * 100)
        : 0;

      const ticketPromedio = documentos > 0 ? Math.round(ventasMes / documentos) : 0;
      const margenBruto    = ventasMes > 0
        ? Math.round(((ventasMes - costoVenta) / ventasMes) * 100)
        : null;

      // Nombre del período seleccionado
      const periodoDate = new Date(yyyy, mm - 1, 1);
      const periodo     = periodoDate.toLocaleString('es-CL', { month: 'long', year: 'numeric' });

      const top10Clientes = (clientesRes.rows ?? []).map((r: any) => ({
        nombre: String(r['Nombre'] ?? '').trim(),
        monto:  Number(r['Monto']) || 0,
      }));

      const top10Productos = (productosRes.rows ?? []).map((r: any) => ({
        nombre: String(r['Nombre'] ?? '').trim(),
        monto:  Number(r['Monto']) || 0,
      }));

      const trend: KpiTrendPoint[] = (trendRes.rows ?? []).map((r: any) => ({
        year:       Number(r['Año'])        || 0,
        month:      Number(r['Mes'])        || 0,
        ventas:     Number(r['Ventas'])     || 0,
        documentos: Number(r['Documentos']) || 0,
        clientes:   Number(r['Clientes'])   || 0,
      }));

      return {
        demo:              false,
        periodo,
        year:              yyyy,
        month:             mm,
        ventasMes,
        ventasMesAnterior: ventasAnterior,
        variacionPct:      variacion,
        documentos,
        clientesActivos:   Number(row['ClientesActivos']) || 0,
        ticketPromedio,
        margenBruto,
        mejorCliente:      top10Clientes[0] ?? null,
        top10Clientes,
        top10Productos,
        trend,
      };
    } catch (err) {
      this.logger.warn('KPI query failed — returning demo values', err);
      return this.getDemoKpis();
    }
  }

  private getDemoKpis(): KpiResponse {
    return {
      demo:              true,
      periodo:           'Demo',
      year:              new Date().getFullYear(),
      month:             new Date().getMonth() + 1,
      ventasMes:         0,
      ventasMesAnterior: 0,
      variacionPct:      0,
      documentos:        0,
      clientesActivos:   0,
      ticketPromedio:    0,
      margenBruto:       null,
      mejorCliente:      null,
      top10Clientes:     [],
      top10Productos:    [],
      trend:             [],
    };
  }

  async *streamQuery(
    question: string,
    jwtUser: JwtPayload,
    forcedModules?: string[],
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): AsyncGenerator<StreamEvent> {
    // 1. Determine modules: forced (from active module context) or auto-detected
    const detectedModules = forcedModules?.length
      ? forcedModules
      : this.schemaService.detectModules(question);

    // 2. ── Permission enforcement via JWT ──────────────────────────────────
    const allowedModules = jwtUser?.allowedModules ?? [];
    // If no modules detected (ambiguous question), send to Claude WITHOUT schema
    // so it can ask the user for clarification rather than guessing.
    // If modules were detected, filter by what the user is allowed to access.
    const modulePrefixes = detectedModules.length > 0
      ? detectedModules.filter((p) => allowedModules.length === 0 || allowedModules.includes(p))
      : [];

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
    if (jwtUser?.tenantId && this.tenantsService) {
      try {
        const tenant = await this.tenantsService.findById(jwtUser.tenantId);
        if (tenant) tenantInfo = tenant as unknown as TenantConnectionInfo;
      } catch (err) {
        this.logger.warn(`[${tenantLabel}] Could not resolve tenant — running with demo DB: ${err}`);
      }
    }

    // 5. ── Schema Context: live DB introspection > JSON fallback ──────────
    // When connected to SQL Server, query INFORMATION_SCHEMA.COLUMNS to get
    // the real table/column names. Falls back to JSON-based schema if unavailable.
    const canUseLiveSchema = tenantInfo !== null || this.databaseService.isConnected();
    const liveSchema = canUseLiveSchema
      ? await this.getLiveSchemaContext(modulePrefixes, tenantInfo)
      : null;
    const schemaContext = liveSchema ?? this.schemaService.getSchemaContext(modulePrefixes, question);
    if (liveSchema) {
      this.logger.log(`[${tenantLabel}] Using LIVE schema from SQL Server`);
    } else {
      this.logger.warn(`[${tenantLabel}] Using JSON schema fallback (DB not connected or introspection failed)`);
    }

    // ── Log schema compression stats ─────────────────────────────────────
    if (modulePrefixes.length > 0) {
      const raw    = this.schemaService.getRawStats(modulePrefixes);
      const tokens = this.schemaService.estimateTokens(schemaContext);
      // Rough full-DDL estimate: avg 60 chars per column in DDL format
      const fullDdlEstimate = Math.ceil((raw.columns * 60) / 4);
      const savingPct = fullDdlEstimate > 0
        ? Math.round((1 - tokens / fullDdlEstimate) * 100)
        : 0;
      this.logger.log(
        `[${tenantLabel}] Schema: ~${tokens} tokens sent` +
        ` (full DDL est. ~${fullDdlEstimate} tokens — ${savingPct}% savings)` +
        ` | ${raw.tables} total tables, ${raw.columns} total cols in KB`,
      );
    }

    // 6. ── Optimization 3: Model Routing ──────────────────────────────────
    const model = this.selectModel(question, modulePrefixes.length);
    this.logger.log(`[${tenantLabel}] Model: ${model}`);

    // 7. Stream from Claude with all optimizations
    let fullText = '';
    const executedSqlBlocks = new Set<string>(); // tracks 'SQL', 'SQL_1', 'SQL_2', etc.

    try {
      // ── Optimization 1: Prompt Caching on system + schema ─────────────
      const stream = await this.anthropic.messages.stream({
        model,
        max_tokens: 1200,
        system: [{
          type: 'text',
          text: buildSystemPrompt(),   // dynamic: injects today's real date
          cache_control: { type: 'ephemeral' },
        }] as any,
        messages: [
          // ── Conversation history: last 6 messages for follow-up context ──
          // Strip internal markers ([SQL], [FOLLOWUPS]) before sending to Claude
          ...((history ?? [])
            .slice(-6)
            .map((h) => ({
              role: h.role,
              content: this.stripMarkers(h.content).slice(0, 600),
            }))
            .filter((h) => h.content.length > 0)
          ),
          // ── Current question with schema context ────────────────────────
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: schemaContext,
                cache_control: { type: 'ephemeral' },
              },
              {
                type: 'text',
                text: `Pregunta: ${question}\n\nGenera SQL T-SQL entre [SQL] y [/SQL] (o [SQL_1]/[SQL_2]/[SQL_3] para análisis multi-dimensional) e interpreta los resultados en español.`,
              },
            ] as any,
          },
        ],
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

      // Track last visible text length to diff-stream only new visible chars.
      // This correctly handles [SQL] and [FOLLOWUPS] markers regardless of how
      // Claude splits them across delta chunks.
      let lastVisibleLen = 0;

      for await (const event of stream as AsyncIterable<MessageStreamEvent>) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullText += event.delta.text;

          // Compute what the user should see: strip SQL blocks and FOLLOWUPS.
          // Supports both [SQL]...[/SQL] and [SQL_N]...[/SQL_N] (multi-query).
          // Incomplete blocks (still streaming) are suppressed by the open-ended regexes.
          const visible = fullText
            .replace(/\[SQL(?:_\d+)?\][\s\S]*?\[\/SQL(?:_\d+)?\]/g, '')  // complete blocks
            .replace(/\[SQL(?:_\d+)?\][\s\S]*/g, '')                       // suppress incomplete block
            .replace(/\[FOLLOWUPS\][\s\S]*/g, '');                          // suppress FOLLOWUPS onward

          // Yield only the newly visible characters since the last yield
          if (visible.length > lastVisibleLen) {
            yield { type: 'delta', delta: visible.slice(lastVisibleLen) };
            lastVisibleLen = visible.length;
          }

          // Execute all completed SQL blocks (single or numbered) not yet executed
          const sqlBlockRegex = /\[(SQL(?:_\d+)?)\]([\s\S]*?)\[\/(?:SQL(?:_\d+)?)\]/g;
          let sqlMatch: RegExpExecArray | null;
          while ((sqlMatch = sqlBlockRegex.exec(fullText)) !== null) {
            const blockTag = sqlMatch[1]; // 'SQL', 'SQL_1', 'SQL_2', 'SQL_3'
            if (!executedSqlBlocks.has(blockTag)) {
              executedSqlBlocks.add(blockTag);
              const execResult = await this.executeSQL(sqlMatch[2].trim(), tenantInfo);
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
  // Models are configurable via env vars so they can be updated without code changes
  // when Anthropic releases new versions or deprecates old ones.
  // Default values are the latest stable models verified at the time of this release.
  private readonly MODEL_FAST   = process.env.CLAUDE_MODEL_FAST   ?? 'claude-haiku-4-5';
  private readonly MODEL_SMART  = process.env.CLAUDE_MODEL_SMART  ?? 'claude-sonnet-4-5';

  private selectModel(question: string, moduleCount: number): string {
    // Use Sonnet ONLY for genuinely complex multi-dimensional analysis.
    // Everything else uses Haiku (3-5x faster, same SQL quality for standard queries).
    const needsSonnet =
      moduleCount >= 3 ||
      /\bversus\b|año\s+a\s+año|tendencia\s+\d|proyecci|forecas|correlaci/i.test(question);
    return needsSonnet ? this.MODEL_SMART : this.MODEL_FAST;
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

  /** Strip internal markers from a message before using it as conversation history */
  private stripMarkers(text: string): string {
    return text
      .replace(/\[SQL\][\s\S]*?\[\/SQL\]/g, '')
      .replace(/\[FOLLOWUPS\][\s\S]*?\[\/FOLLOWUPS\]/g, '')
      .replace(/\[FOLLOWUPS\][\s\S]*/g, '') // handle incomplete block
      .replace(/Consultando la base de datos\.\.\.\n\n?/g, '')
      .trim();
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

  /**
   * Query the live SQL Server schema for the given module prefixes.
   * Returns a compact schema context string, or null if unavailable.
   * Falls back gracefully so JSON-based schema is used instead.
   */
  private async getLiveSchemaContext(
    prefixes: string[],
    tenant: TenantConnectionInfo | null,
  ): Promise<string | null> {
    // Only allow safe uppercase module prefixes to prevent SQL injection
    const safePrefixes = prefixes.filter((p) => /^[A-Z]{2,5}$/.test(p));
    if (safePrefixes.length === 0) return null;

    // Check cache first — avoids re-querying INFORMATION_SCHEMA on every request
    const cacheKey = `${tenant?.id ?? 'demo'}:${safePrefixes.sort().join(',')}`;
    const cached = this.schemaCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.logger.log(`Live schema cache HIT for [${safePrefixes.join(',')}]`);
      return cached.context;
    }

    try {
      const rows = await this.databaseService.introspectModuleTables(tenant, safePrefixes);
      if (!rows.length) return null;

      const tableMap = new Map<string, string[]>();
      for (const row of rows) {
        const tname = row['TABLE_NAME'] as string;
        const col   = row['COLUMN_NAME'] as string;
        const type  = this.dbTypeToCompact(
          row['DATA_TYPE'] as string,
          row['CHARACTER_MAXIMUM_LENGTH'] as number | null,
          row['NUMERIC_PRECISION'] as number | null,
          row['NUMERIC_SCALE'] as number | null,
        );
        // Enrich with human-readable title from GeneXus KB (92% coverage)
        const title = this.schemaService.getAttributeTitle(col);
        const colDef = title
          ? `${col}:${type}(${title.replace(/\s+/g, '_')})`
          : `${col}:${type}`;
        if (!tableMap.has(tname)) tableMap.set(tname, []);
        tableMap.get(tname)!.push(colDef);
      }

      const now    = new Date();
      const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const lines = [
        '-- I-NET ERP (SQL Server) — Schema en vivo',
        `-- FECHA HOY: ${now.toISOString().slice(0, 10)} | MES ACTUAL: ${yyyymm} | AÑO: ${now.getFullYear()}`,
        '-- Fechas DATETIME: usa YEAR()/MONTH()/DATEADD() normalmente',
        `-- Fechas CHAR(6) YYYYMM (ej: COMANOMES INT): WHERE campo = ${yyyymm}  (sin comillas si es INT)`,
        `-- Fechas CHAR(8) YYYYMMDD: WHERE LEFT(campo,6) = '${yyyymm}'`,
        '',
      ];
      for (const [tname, cols] of tableMap) {
        // Add table description from GeneXus KB if available
        const tableDesc = this.schemaService.getTableDescription(tname);
        lines.push(tableDesc ? `[${tname}] -- ${tableDesc}` : `[${tname}]`);
        lines.push(`  ${cols.join(' ')}`);
      }
      const result = lines.join('\n');

      // Evict expired entries before adding new ones to keep the cache bounded
      if (this.schemaCache.size >= this.SCHEMA_CACHE_MAX_SIZE) {
        const now = Date.now();
        for (const [k, v] of this.schemaCache) {
          if (v.expiresAt <= now) this.schemaCache.delete(k);
        }
        // If still over limit, evict the first (oldest) entry
        if (this.schemaCache.size >= this.SCHEMA_CACHE_MAX_SIZE) {
          const firstKey = this.schemaCache.keys().next().value;
          if (firstKey) this.schemaCache.delete(firstKey);
        }
      }

      this.schemaCache.set(cacheKey, { context: result, expiresAt: Date.now() + this.SCHEMA_CACHE_TTL_MS });
      this.logger.log(`Live schema: ${tableMap.size} tables for [${safePrefixes.join(',')}] — cached 15min`);
      return result;
    } catch (err) {
      this.logger.warn('Live schema introspection failed — falling back to JSON schema', err);
      return null;
    }
  }

  private dbTypeToCompact(
    type: string,
    len: number | null,
    prec: number | null,
    scale: number | null,
  ): string {
    const t = (type ?? '').toLowerCase();
    if (t === 'int' || t === 'bigint' || t === 'smallint' || t === 'tinyint') return 'INT';
    if (t === 'bit') return 'BIT';
    if (t === 'decimal' || t === 'numeric') return scale ? `N${prec}.${scale}` : `N${prec ?? ''}`;
    if (t === 'char') return `C${len ?? ''}`;
    if (t === 'varchar' || t === 'nvarchar') return `VC${len ?? 'MAX'}`;
    if (t === 'nchar') return `NC${len ?? ''}`;
    if (t === 'date') return 'DATE';
    if (t === 'datetime' || t === 'datetime2' || t === 'smalldatetime') return 'DATETIME';
    if (t === 'float' || t === 'real') return 'FLOAT';
    if (t === 'money' || t === 'smallmoney') return 'MONEY';
    if (t === 'text' || t === 'ntext') return 'TEXT';
    return type.toUpperCase();
  }

  private inferColType(name: string, dbType: string): string {
    const n = name.toLowerCase();
    const t = dbType.toLowerCase();
    // 1. Identifiers — look numeric but must stay as strings (RUT, codes)
    if (/\brut\b|rut$|^rut|codigo|^cod$|cod_|_cod$|sucursal$/.test(n)) return 'string';
    // 2. Years and months — no thousands-separator (2025 → never "2.025")
    if (/^a[nñ]io$|^year$|^anio$|^mes$|^month$/.test(n)) return 'string';
    // 3. Count / quantity columns — MUST come before currency check.
    //    "DocumentosVenta" contains "venta" but is a COUNT → must be 'number', not 'currency'
    if (/cantidad|cant\b|cnt\b|count\b|n[uú]mero\s*de|^num\b|^nro\b|documentos|registros|lineas|items|unidades/.test(n)) return 'number';
    // 4. Currency — detect by name keywords OR by SQL Server money types
    if (/monto|total|valor|precio|costo|saldo|importe|deuda|venta|neto|bruto|neta|bruta|ingreso|margen|iva|descuento|recargo|comision/.test(n)) return 'currency';
    if (t === 'money' || t === 'smallmoney') return 'currency';
    // 5. Dates
    if (/fecha|fch|date/.test(n) || t === 'datetime' || t === 'date') return 'date';
    // 6. Generic integers
    if (t === 'int' || t === 'bigint' || t === 'smallint' || t === 'tinyint') return 'number';
    if (t.includes('decimal') || t.includes('numeric') || t.includes('float')) return 'number';
    return 'string';
  }

  private inferChartConfig(rows: Record<string, unknown>[], cols: ColumnDef[]): ChartConfig | undefined {
    if (rows.length < 2 || rows.length > 50) return undefined;
    // Prefer currency columns over plain numbers as the Y axis
    const currencyCols = cols.filter((c) => c.type === 'currency');
    const numCols      = cols.filter((c) => c.type === 'number');
    const strCols      = cols.filter((c) => c.type === 'string');
    // X axis: first string column that is NOT a RUT/code (avoid numeric-looking strings)
    const xCol = strCols[0];
    // Y axis: first currency column, fallback to first numeric
    const yCol = currencyCols[0] ?? numCols[0];
    if (xCol && yCol) {
      const chartType = rows.length <= 12 ? 'bar' : 'line';
      return { type: chartType, xKey: xCol.key, yKey: yCol.key, yLabel: yCol.label };
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
