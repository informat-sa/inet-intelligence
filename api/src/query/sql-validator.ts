/**
 * SQL Safety Validator
 * Only allows SELECT statements. Blocks ALL data-modifying and DDL commands.
 */

const BLOCKED_PATTERNS = [
  /\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|CREATE|ALTER|EXEC|EXECUTE|SP_|XP_|MERGE|BULK)\b/i,
  /\b(GRANT|REVOKE|DENY|USE|BACKUP|RESTORE)\b/i,
  /--.*?(;|$)/gm,          // SQL comments with statement terminator
  /\/\*[\s\S]*?\*\//g,     // Block comments
  /;\s*(SELECT|INSERT|UPDATE|DELETE)/i,  // Stacked queries
  /WAITFOR\s+DELAY/i,
  /OPENROWSET|OPENDATASOURCE|OPENQUERY/i,
  /\bSYSTEM_USER\b|\bDB_NAME\b|\bOBJECT_ID\b/i,
];

const MAX_ROWS_CLAUSE = 'TOP 1000';

export interface ValidationResult {
  valid: boolean;
  sql: string;
  error?: string;
}

export function validateAndSanitizeSQL(rawSql: string): ValidationResult {
  let sql = rawSql.trim();

  // Remove any markdown code fences
  sql = sql.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '').trim();

  // Must start with SELECT
  if (!/^\s*SELECT\b/i.test(sql)) {
    return {
      valid: false,
      sql: '',
      error: 'Only SELECT statements are allowed.',
    };
  }

  // Check blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(sql)) {
      return {
        valid: false,
        sql: '',
        error: `Blocked pattern detected: ${pattern.source.slice(0, 40)}`,
      };
    }
  }

  // Enforce row limit — inject TOP 1000 if not present
  if (!/\bSELECT\s+TOP\s+\d+\b/i.test(sql)) {
    sql = sql.replace(/\bSELECT\b/i, `SELECT ${MAX_ROWS_CLAUSE}`);
  }

  // Ensure single statement (no semicolons except at the very end)
  const withoutStrings = sql.replace(/'[^']*'/g, "''");
  const semicolons = (withoutStrings.match(/;/g) ?? []).length;
  if (semicolons > 1 || (semicolons === 1 && !withoutStrings.trimEnd().endsWith(';'))) {
    return { valid: false, sql: '', error: 'Multiple statements are not allowed.' };
  }

  return { valid: true, sql };
}
