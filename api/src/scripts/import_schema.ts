/**
 * import_schema.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Convierte la planilla Excel de schemas aportada por un programador de INET
 * en el bloque TypeScript listo para pegar en REAL_SQL_TABLES (schema.service.ts).
 *
 * USO:
 *   npx ts-node src/scripts/import_schema.ts <archivo.xlsx>
 *
 * EJEMPLO:
 *   npx ts-node src/scripts/import_schema.ts schemas/VFA_schema.xlsx
 *
 * El script imprime el bloque TypeScript en la consola.
 * Copia y pega el resultado dentro de REAL_SQL_TABLES en schema.service.ts.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs   from 'fs';

// ── Tipos internos ────────────────────────────────────────────────────────────
interface ExcelRow {
  Tabla:               string;
  Descripcion_Tabla:   string;
  Columna:             string;
  Descripcion_Columna: string;
  Tipo:                string;
  Largo:               number | string;
  Decimales:           number | string;
}

interface Attribute {
  id:     string;
  name:   string;
  title:  string;
  type:   string;
  length: number;
  dec:    number;
}

interface Table {
  name:        string;
  description: string;
  attributes:  Attribute[];
}

// ── Normaliza tipo SQL Server → tipo INET ────────────────────────────────────
function normalizeType(sqlType: string): string {
  const t = (sqlType ?? '').toLowerCase().trim();
  if (['int', 'bigint', 'smallint', 'tinyint', 'decimal', 'numeric', 'float', 'real', 'money', 'smallmoney'].includes(t)) return 'n';
  if (['date', 'datetime', 'datetime2', 'smalldatetime'].includes(t)) return 'd';
  if (['bit'].includes(t)) return 'b';
  return 'string'; // varchar, char, nvarchar, text, etc.
}

// ── Genera un id limpio a partir del nombre de columna ────────────────────────
function toId(colName: string): string {
  return 'r_' + colName.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

// ── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('\n❌  Falta el archivo Excel.');
    console.error('   Uso: npx ts-node src/scripts/import_schema.ts <archivo.xlsx>\n');
    process.exit(1);
  }

  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`\n❌  Archivo no encontrado: ${absPath}\n`);
    process.exit(1);
  }

  // ── Leer Excel ──────────────────────────────────────────────────────────────
  const wb    = XLSX.readFile(absPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: '' });

  if (rows.length === 0) {
    console.error('\n❌  La planilla está vacía o no tiene el formato correcto.\n');
    process.exit(1);
  }

  // ── Validar columnas obligatorias ──────────────────────────────────────────
  const required = ['Tabla', 'Columna', 'Tipo'];
  const missing  = required.filter(c => !(c in rows[0]));
  if (missing.length > 0) {
    console.error(`\n❌  Faltan columnas en la planilla: ${missing.join(', ')}`);
    console.error('   Las columnas obligatorias son: Tabla, Descripcion_Tabla, Columna, Descripcion_Columna, Tipo, Largo, Decimales\n');
    process.exit(1);
  }

  // ── Agrupar por tabla ──────────────────────────────────────────────────────
  const tablesMap = new Map<string, Table>();
  let   rowNum    = 2; // Excel row number (1 = header)
  let   warnings  = 0;

  for (const row of rows) {
    const tableName = String(row.Tabla ?? '').trim().toUpperCase();
    const colName   = String(row.Columna ?? '').trim().toUpperCase();

    if (!tableName || !colName) {
      console.warn(`⚠️   Fila ${rowNum}: Tabla o Columna vacíos — fila ignorada`);
      warnings++;
      rowNum++;
      continue;
    }

    if (!tablesMap.has(tableName)) {
      tablesMap.set(tableName, {
        name:        tableName,
        description: String(row.Descripcion_Tabla ?? '').trim() || `Tabla ${tableName}`,
        attributes:  [],
      });
    }

    const table  = tablesMap.get(tableName)!;
    const length = parseInt(String(row.Largo     ?? '0'), 10) || 0;
    const dec    = parseInt(String(row.Decimales ?? '0'), 10) || 0;
    const type   = normalizeType(String(row.Tipo ?? ''));
    const title  = String(row.Descripcion_Columna ?? '').trim() || colName;

    table.attributes.push({
      id:     toId(colName),
      name:   colName,
      title,
      type,
      length,
      dec,
    });

    rowNum++;
  }

  if (tablesMap.size === 0) {
    console.error('\n❌  No se encontraron tablas válidas en la planilla.\n');
    process.exit(1);
  }

  // ── Detectar prefijo (primeras 3 letras de la primera tabla) ───────────────
  const firstTable = [...tablesMap.keys()][0];
  const prefix     = firstTable.slice(0, 3).toUpperCase();
  const allSamePrefix = [...tablesMap.keys()].every(t => t.toUpperCase().startsWith(prefix));

  if (!allSamePrefix) {
    console.warn(`\n⚠️   Las tablas tienen prefijos distintos. Usando "${prefix}" como clave principal.`);
    console.warn('   Revisa el bloque generado y ajusta la clave si es necesario.\n');
    warnings++;
  }

  // ── Generar TypeScript ────────────────────────────────────────────────────
  const tables  = [...tablesMap.values()];
  const maxName = Math.max(...tables.flatMap(t => t.attributes.map(a => a.name.length)));

  const lines: string[] = [];
  lines.push(`  // ── ${prefix} ─ generado por import_schema.ts desde ${path.basename(filePath)} ──`);
  lines.push(`  '${prefix}': [`);

  for (const table of tables) {
    lines.push(`    {`);
    lines.push(`      name:        '${table.name}',`);
    lines.push(`      description: '${table.description.replace(/'/g, "\\'")}',`);
    lines.push(`      attributes: [`);

    for (const a of table.attributes) {
      const namePad  = `'${a.name}'`.padEnd(maxName + 2);
      const titlePad = `'${a.title.replace(/'/g, "\\'")}'`.padEnd(42);
      lines.push(`        { id: '${toId(a.name)}', name: ${namePad}, title: ${titlePad}, type: '${a.type}', length: ${a.length}, dec: ${a.dec} },`);
    }

    lines.push(`      ],`);
    lines.push(`    },`);
  }

  lines.push(`  ],`);

  // ── Resumen ────────────────────────────────────────────────────────────────
  const totalAttrs = tables.reduce((s, t) => s + t.attributes.length, 0);

  console.log('\n' + '─'.repeat(72));
  console.log(`✅  Módulo:   ${prefix}`);
  console.log(`   Tablas:   ${tables.length}`);
  console.log(`   Columnas: ${totalAttrs}`);
  if (warnings > 0) console.log(`   Avisos:   ${warnings} (ver arriba)`);
  console.log('─'.repeat(72));
  console.log('\n📋  COPIA ESTE BLOQUE dentro de REAL_SQL_TABLES en schema.service.ts:\n');
  console.log(lines.join('\n'));
  console.log('\n' + '─'.repeat(72) + '\n');
}

main();
