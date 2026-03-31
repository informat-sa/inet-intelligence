/**
 * create_schema_template.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Genera una plantilla Excel vacía con el formato correcto para que los
 * programadores de INET puedan llenar los schemas de sus módulos.
 *
 * USO:
 *   npx ts-node src/scripts/create_schema_template.ts [PREFIJO]
 *
 * EJEMPLOS:
 *   npx ts-node src/scripts/create_schema_template.ts VFA
 *   npx ts-node src/scripts/create_schema_template.ts        (genera plantilla genérica)
 *
 * El archivo se guarda en la carpeta actual como PREFIJO_schema_template.xlsx
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as XLSX from 'xlsx';
import * as path from 'path';

function main() {
  const prefix   = (process.argv[2] ?? 'MODULO').toUpperCase();
  const filename = `${prefix}_schema_template.xlsx`;

  // ── Hoja 1: Plantilla a completar ─────────────────────────────────────────
  const headers = [
    'Tabla',
    'Descripcion_Tabla',
    'Columna',
    'Descripcion_Columna',
    'Tipo',
    'Largo',
    'Decimales',
  ];

  // Filas de ejemplo para que vean el formato esperado
  const examples = [
    [`${prefix}ENCA`, 'Encabezado del documento (reemplaza con descripción real)', `${prefix}ENCNUM`, 'Número del documento', 'int',     10, 0],
    [`${prefix}ENCA`, '',                                                            `${prefix}CLINUM`, 'RUT del cliente',      'varchar', 12, 0],
    [`${prefix}ENCA`, '',                                                            `${prefix}TOTNET`, 'Total neto sin IVA (pesos CLP)',     'decimal', 15, 2],
    [`${prefix}ENCA`, '',                                                            `${prefix}ESTADO`, 'Estado: A=Activo, N=Anulado',        'char',     1, 0],
    [`${prefix}DETA`, 'Detalle de líneas (reemplaza con descripción real)',          `${prefix}DETLIN`, 'Número de línea',       'int',      5, 0],
    [`${prefix}DETA`, '',                                                            `${prefix}ARTCOD`, 'Código de artículo',     'varchar', 15, 0],
    [`${prefix}DETA`, '',                                                            `${prefix}CANPED`, 'Cantidad pedida',        'decimal', 12, 3],
    [`${prefix}DETA`, '',                                                            `${prefix}PREUNI`, 'Precio unitario neto',   'decimal', 15, 2],
  ];

  const wsData = [headers, ...examples];
  const ws     = XLSX.utils.aoa_to_sheet(wsData);

  // Ancho de columnas
  ws['!cols'] = [
    { wch: 20 }, // Tabla
    { wch: 50 }, // Descripcion_Tabla
    { wch: 20 }, // Columna
    { wch: 50 }, // Descripcion_Columna  ← la más importante
    { wch: 12 }, // Tipo
    { wch:  8 }, // Largo
    { wch: 10 }, // Decimales
  ];

  // ── Hoja 2: Instrucciones rápidas ─────────────────────────────────────────
  const instrucciones = [
    ['I-NET Intelligence — Plantilla de Schema'],
    [''],
    ['INSTRUCCIONES:'],
    ['1. Reemplaza las filas de ejemplo con las tablas y columnas REALES de tu módulo.'],
    ['2. Para obtener las columnas reales, ejecuta en SQL Server Management Studio:'],
    [''],
    [`   SELECT t.TABLE_NAME AS Tabla, '' AS Descripcion_Tabla,`],
    [`          c.COLUMN_NAME AS Columna, '' AS Descripcion_Columna,`],
    [`          c.DATA_TYPE AS Tipo,`],
    [`          ISNULL(c.CHARACTER_MAXIMUM_LENGTH, c.NUMERIC_PRECISION) AS Largo,`],
    [`          ISNULL(c.NUMERIC_SCALE, 0) AS Decimales`],
    [`   FROM INFORMATION_SCHEMA.TABLES t`],
    [`   JOIN INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME`],
    [`   WHERE t.TABLE_NAME LIKE '${prefix}%' AND t.TABLE_TYPE = 'BASE TABLE'`],
    [`   ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION`],
    [''],
    ['3. Exporta esa query a Excel (clic derecho → Save Results As...).'],
    ['4. Pega los resultados en la Hoja 1, reemplazando las filas de ejemplo.'],
    ['5. Llena las columnas Descripcion_Tabla y Descripcion_Columna con lenguaje de negocio.'],
    ['6. Guarda el archivo como: ' + `${prefix}_schema.xlsx`],
    ['7. Envía el archivo a Sebastián.'],
    [''],
    ['TIPS para las descripciones:'],
    ['- Si guarda un código → especifica qué tipo: "Código de cliente (RUT sin puntos)"'],
    ['- Si guarda estados   → lista los valores: "A=Activo, N=Anulado, P=Pendiente"'],
    ['- Si guarda montos    → menciona la unidad: "Total en pesos chilenos, sin IVA"'],
    ['- Si no sabes         → deja la celda en blanco (no inventes)'],
    [''],
    ['COLUMNAS OBLIGATORIAS: Tabla, Columna, Tipo'],
    ['COLUMNAS QUE TÚ LLENAS: Descripcion_Tabla, Descripcion_Columna'],
  ];

  const wsInst = XLSX.utils.aoa_to_sheet(instrucciones);
  wsInst['!cols'] = [{ wch: 90 }];

  // ── Workbook ──────────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws,     `Schema ${prefix}`);
  XLSX.utils.book_append_sheet(wb, wsInst, 'Instrucciones');

  XLSX.writeFile(wb, filename);

  console.log(`\n✅  Plantilla creada: ${path.resolve(filename)}`);
  console.log(`   Hoja 1: Schema ${prefix}  (completar con tablas y descripciones)`);
  console.log(`   Hoja 2: Instrucciones\n`);
  console.log('   Comparte este archivo con el programador responsable del módulo.');
  console.log('   Cuando lo devuelva completo, corre:\n');
  console.log(`   npx ts-node src/scripts/import_schema.ts ${prefix}_schema.xlsx\n`);
}

main();
