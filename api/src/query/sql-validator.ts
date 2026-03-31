/**
 * SQL Safety Validator
 * Only allows SELECT statements. Blocks ALL data-modifying and DDL commands.
 */

const BLOCKED_PATTERNS = [
  /\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|CREATE|ALTER|EXEC|EXECUTE|SP_|XP_|MERGE|BULK)\b/i,
  /\b(GRANT|REVOKE|DENY|USE|BACKUP|RESTORE)\b/i,
  /--[^\r\n]*/gm,           // ALL inline SQL comments (not just those with semicolons)
  /\/\*[\s\S]*?\*\//g,      // Block comments
  /;\s*(SELECT|INSERT|UPDATE|DELETE)/i,  // Stacked queries
  /WAITFOR\s+DELAY/i,
  /OPENROWSET|OPENDATASOURCE|OPENQUERY/i,
  /\bSYSTEM_USER\b|\bDB_NAME\b|\bOBJECT_ID\b/i,
];

const MAX_ROWS = 1000;

export interface ValidationResult {
  valid: boolean;
  sql: string;
  error?: string;
}

/**
 * Inject TOP N into the OUTERMOST SELECT of a query.
 * Correctly handles CTEs (WITH ... AS (...) SELECT ...) by targeting
 * the final SELECT after the CTE definitions, not the SELECT inside the CTE.
 */
function injectTopLimit(sql: string, limit: number): string {
  // Already has TOP somewhere at the outer level — check the outermost SELECT
  // Strip WITH...AS blocks to find the outer SELECT
  const strippedCTE = sql.replace(/^\s*WITH\s+[\s\S]+?\)\s*/i, '');
  if (/^\s*SELECT\s+TOP\s+\d+\b/i.test(strippedCTE)) {
    return sql; // outer SELECT already has TOP
  }

  // For CTEs: inject TOP after the final outermost SELECT
  // Match the last SELECT that is NOT inside parentheses (depth=0)
  let depth = 0;
  let outerSelectPos = -1;
  const upper = sql.toUpperCase();

  for (let i = 0; i < sql.length; i++) {
    if (sql[i] === '(') depth++;
    else if (sql[i] === ')') depth--;
    else if (depth === 0 && upper.slice(i).startsWith('SELECT')) {
      outerSelectPos = i;
      // Don't break — we want the LAST outer SELECT (after all CTEs)
    }
  }

  if (outerSelectPos === -1) return sql;

  // Check if this outer SELECT already has TOP
  const afterSelect = sql.slice(outerSelectPos + 6).trimStart();
  if (/^TOP\s+\d+/i.test(afterSelect)) return sql;

  return (
    sql.slice(0, outerSelectPos + 6) +
    ` TOP ${limit} ` +
    sql.slice(outerSelectPos + 6)
  );
}

export function validateAndSanitizeSQL(rawSql: string): ValidationResult {
  let sql = rawSql.trim();

  // Remove any markdown code fences
  sql = sql.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '').trim();

  // Allow CTEs: WITH ... AS (...) SELECT ...
  const isSelectOrCTE = /^\s*(WITH\s+\w|SELECT\b)/i.test(sql);
  if (!isSelectOrCTE) {
    return {
      valid: false,
      sql: '',
      error: 'Only SELECT statements (including CTEs) are allowed.',
    };
  }

  // Check blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    // Reset stateful regexes before each test
    if (pattern.global) pattern.lastIndex = 0;
    if (pattern.test(sql)) {
      if (pattern.global) pattern.lastIndex = 0;
      return {
        valid: false,
        sql: '',
        error: `Blocked pattern detected: ${pattern.source.slice(0, 40)}`,
      };
    }
  }

  // Enforce row limit — inject TOP into outermost SELECT if not present
  sql = injectTopLimit(sql, MAX_ROWS);

  // Ensure single statement — no semicolons mid-query
  // Replace string literals to avoid counting semicolons inside them
  const withoutStrings = sql.replace(/'(?:[^']|'')*'/g, "''");
  const semicolons = (withoutStrings.match(/;/g) ?? []).length;
  if (semicolons > 1 || (semicolons === 1 && !withoutStrings.trimEnd().endsWith(';'))) {
    return { valid: false, sql: '', error: 'Multiple statements are not allowed.' };
  }

  return { valid: true, sql };
}
