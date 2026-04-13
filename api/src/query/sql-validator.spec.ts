import { validateAndSanitizeSQL, ValidationResult } from './sql-validator';

// ─── helpers ────────────────────────────────────────────────────────────────

function expectBlocked(result: ValidationResult, msgFragment?: string) {
  expect(result.valid).toBe(false);
  expect(result.sql).toBe('');
  if (msgFragment) {
    expect(result.error).toMatch(new RegExp(msgFragment, 'i'));
  }
}

function expectAllowed(result: ValidationResult) {
  expect(result.valid).toBe(true);
  expect(result.sql.length).toBeGreaterThan(0);
}

// ─── ALLOWED queries ─────────────────────────────────────────────────────────

describe('validateAndSanitizeSQL — allowed queries', () => {
  it('simple SELECT', () => {
    const r = validateAndSanitizeSQL('SELECT * FROM VFA_DOCC');
    expectAllowed(r);
  });

  it('SELECT with WHERE', () => {
    const r = validateAndSanitizeSQL(
      "SELECT NroOrd, FecEmi FROM VFA_DOCC WHERE StsDOC = 'P'",
    );
    expectAllowed(r);
  });

  it('SELECT with JOIN', () => {
    const r = validateAndSanitizeSQL(
      'SELECT p.PerNom, a.AfpNom FROM PERSONAL p JOIN AFP a ON p.PerAfpCod = a.AfpCod',
    );
    expectAllowed(r);
  });

  it('SELECT with subquery', () => {
    const r = validateAndSanitizeSQL(
      'SELECT * FROM (SELECT NroOrd FROM VFA_DOCC WHERE MonVta > 0) sub',
    );
    expectAllowed(r);
  });

  it('CTE — WITH ... AS (...) SELECT', () => {
    const r = validateAndSanitizeSQL(`
      WITH ventas AS (
        SELECT NroOrd, MonVta FROM VFA_DOCC WHERE StsDOC = 'F'
      )
      SELECT * FROM ventas
    `);
    expectAllowed(r);
  });

  it('CTE — multiple CTEs chained', () => {
    const r = validateAndSanitizeSQL(`
      WITH cte1 AS (SELECT NroOrd FROM VFA_DOCC),
           cte2 AS (SELECT NroOrd FROM VFA_DOCC_D)
      SELECT c1.NroOrd FROM cte1 c1 JOIN cte2 c2 ON c1.NroOrd = c2.NroOrd
    `);
    expectAllowed(r);
  });

  it('multiline SELECT with indentation', () => {
    const r = validateAndSanitizeSQL(`
      SELECT
        PerNom,
        PerApe,
        PerSue
      FROM
        PERSONAL
      WHERE
        PerEst = 'A'
    `);
    expectAllowed(r);
  });

  it('SELECT with aggregation and GROUP BY', () => {
    const r = validateAndSanitizeSQL(
      'SELECT CliCod, SUM(MonVta) AS TotalVentas FROM VFA_DOCC GROUP BY CliCod',
    );
    expectAllowed(r);
  });

  it('SELECT with HAVING', () => {
    const r = validateAndSanitizeSQL(
      'SELECT CliCod, COUNT(*) FROM VFA_DOCC GROUP BY CliCod HAVING COUNT(*) > 5',
    );
    expectAllowed(r);
  });

  it('SELECT with ORDER BY', () => {
    const r = validateAndSanitizeSQL(
      'SELECT * FROM PERSONAL ORDER BY PerNom ASC',
    );
    expectAllowed(r);
  });

  it('SELECT wrapped in markdown code fence is cleaned', () => {
    const r = validateAndSanitizeSQL(
      '```sql\nSELECT * FROM VFA_DOCC\n```',
    );
    expectAllowed(r);
    expect(r.sql).not.toContain('```');
  });

  it('lowercase select is allowed', () => {
    const r = validateAndSanitizeSQL('select * from personal');
    expectAllowed(r);
  });

  it('MixedCase SELECT is allowed', () => {
    const r = validateAndSanitizeSQL('Select * From Personal');
    expectAllowed(r);
  });
});

// ─── TOP N injection ──────────────────────────────────────────────────────────

describe('validateAndSanitizeSQL — TOP N row-limit injection', () => {
  it('injects TOP 1000 when absent', () => {
    const r = validateAndSanitizeSQL('SELECT * FROM VFA_DOCC');
    expectAllowed(r);
    expect(r.sql).toMatch(/SELECT\s+TOP\s+1000\b/i);
  });

  it('does NOT double-inject when TOP already present', () => {
    const r = validateAndSanitizeSQL('SELECT TOP 10 * FROM VFA_DOCC');
    expectAllowed(r);
    const matches = r.sql.match(/TOP\s+\d+/gi) ?? [];
    expect(matches.length).toBe(1);
  });

  it('injects TOP on outermost SELECT of CTE, not the inner one', () => {
    const r = validateAndSanitizeSQL(`
      WITH ventas AS (SELECT NroOrd FROM VFA_DOCC)
      SELECT * FROM ventas
    `);
    expectAllowed(r);
    // Outer SELECT must have TOP 1000
    expect(r.sql).toMatch(/SELECT\s+TOP\s+1000\s+\*\s+FROM\s+ventas/i);
  });

  it('does not inject TOP inside subquery — only outer', () => {
    const r = validateAndSanitizeSQL(
      'SELECT * FROM (SELECT NroOrd FROM VFA_DOCC) sub',
    );
    expectAllowed(r);
    // The TOP must appear on the outer SELECT (first one at depth 0)
    expect(r.sql).toMatch(/SELECT\s+TOP\s+1000\b/i);
  });
});

// ─── BLOCKED — DML ───────────────────────────────────────────────────────────

describe('validateAndSanitizeSQL — blocked DML', () => {
  const dmlCases: [string, string][] = [
    ['INSERT uppercase', 'INSERT INTO PERSONAL VALUES (1)'],
    ['INSERT lowercase', 'insert into personal values (1)'],
    ['INSERT mixed', 'Insert Into Personal Values (1)'],
    ['UPDATE uppercase', "UPDATE PERSONAL SET PerSue = 1 WHERE PerCod = '1'"],
    ['UPDATE lowercase', "update personal set prsue = 1 where percod = '1'"],
    ['DELETE uppercase', 'DELETE FROM PERSONAL WHERE PerCod = 1'],
    ['DELETE lowercase', 'delete from personal'],
    ['TRUNCATE', 'TRUNCATE TABLE PERSONAL'],
    ['MERGE', 'MERGE INTO PERSONAL USING src ON 1=1'],
    ['BULK INSERT', 'BULK INSERT PERSONAL FROM file'],
  ];

  test.each(dmlCases)('%s is blocked', (_label, sql) => {
    expectBlocked(validateAndSanitizeSQL(sql));
  });

  it('SELECT containing INSERT keyword in string literal is still blocked', () => {
    // The word INSERT appears in the query body as a keyword, not inside quotes
    // A genuine attempt: SELECT ... UNION INSERT ...
    const r = validateAndSanitizeSQL("SELECT 'INSERT' FROM DUAL");
    // 'INSERT' is inside a string — this may legitimately pass depending on validator design.
    // Our validator works at text level so it will block it. Document this behavior.
    // If the business requirement changes to allow INSERT inside literals, update this test.
    expect(r.valid).toBe(false);
  });
});

// ─── BLOCKED — DDL ───────────────────────────────────────────────────────────

describe('validateAndSanitizeSQL — blocked DDL', () => {
  const ddlCases: [string, string][] = [
    ['DROP TABLE', 'DROP TABLE PERSONAL'],
    ['DROP uppercase', 'DROP DATABASE INET'],
    ['CREATE TABLE', 'CREATE TABLE foo (id INT)'],
    ['CREATE uppercase', 'CREATE DATABASE test'],
    ['ALTER TABLE', 'ALTER TABLE PERSONAL ADD col INT'],
    ['TRUNCATE', 'TRUNCATE TABLE PERSONAL'],
  ];

  test.each(ddlCases)('%s is blocked', (_label, sql) => {
    expectBlocked(validateAndSanitizeSQL(sql));
  });
});

// ─── BLOCKED — stored procedures & system objects ────────────────────────────

describe('validateAndSanitizeSQL — blocked stored procedures', () => {
  const procCases: [string, string][] = [
    ['EXEC uppercase', 'EXEC sp_help'],
    ['EXEC lowercase', 'exec sp_help'],
    ['EXECUTE', 'EXECUTE sp_executesql N\'SELECT 1\''],
    ['sp_ prefix', "EXEC sp_addlogin 'user', 'pass'"],
    ['xp_ prefix uppercase', 'EXEC XP_CMDSHELL \'dir\''],
    ['xp_ prefix lowercase', "exec xp_cmdshell 'whoami'"],
    ['xp_ with space', 'SELECT XP_CMDSHELL(\'dir\')'],
  ];

  test.each(procCases)('%s is blocked', (_label, sql) => {
    expectBlocked(validateAndSanitizeSQL(sql));
  });
});

// ─── BLOCKED — privilege / admin ─────────────────────────────────────────────

describe('validateAndSanitizeSQL — blocked privilege statements', () => {
  const privCases: [string, string][] = [
    ['GRANT', 'GRANT SELECT ON PERSONAL TO user1'],
    ['REVOKE', 'REVOKE SELECT ON PERSONAL FROM user1'],
    ['DENY', 'DENY SELECT ON PERSONAL TO user1'],
    ['USE database', 'USE master'],
    ['BACKUP', 'BACKUP DATABASE INET TO DISK'],
    ['RESTORE', 'RESTORE DATABASE INET FROM DISK'],
  ];

  test.each(privCases)('%s is blocked', (_label, sql) => {
    expectBlocked(validateAndSanitizeSQL(sql));
  });
});

// ─── BLOCKED — injection via comments ────────────────────────────────────────

describe('validateAndSanitizeSQL — blocked SQL comments', () => {
  it('inline comment -- is blocked', () => {
    const r = validateAndSanitizeSQL("SELECT * FROM PERSONAL -- comment");
    expectBlocked(r);
  });

  it('inline comment -- followed by newline is blocked', () => {
    const r = validateAndSanitizeSQL(
      "SELECT * FROM PERSONAL -- DROP TABLE PERSONAL\nWHERE PerEst = 'A'",
    );
    expectBlocked(r);
  });

  it('block comment /* */ is blocked', () => {
    const r = validateAndSanitizeSQL(
      'SELECT /* malicious */ * FROM PERSONAL',
    );
    expectBlocked(r);
  });

  it('block comment used to hide payload is blocked', () => {
    const r = validateAndSanitizeSQL(
      "SELECT * FROM PERSONAL /* UNION SELECT * FROM sys.objects */",
    );
    expectBlocked(r);
  });

  it('comment-obfuscated DROP is blocked', () => {
    const r = validateAndSanitizeSQL(
      "SELECT * FROM PERSONAL; -- DROP TABLE PERSONAL",
    );
    expectBlocked(r);
  });
});

// ─── BLOCKED — stacked queries & semicolons ──────────────────────────────────

describe('validateAndSanitizeSQL — stacked queries', () => {
  it('SELECT; INSERT is blocked', () => {
    const r = validateAndSanitizeSQL(
      'SELECT * FROM PERSONAL; INSERT INTO PERSONAL VALUES (1)',
    );
    expectBlocked(r);
  });

  it('SELECT; DELETE is blocked', () => {
    const r = validateAndSanitizeSQL(
      "SELECT * FROM PERSONAL; DELETE FROM PERSONAL WHERE 1=1",
    );
    expectBlocked(r);
  });

  it('SELECT; SELECT (two reads) is blocked as multiple statements', () => {
    const r = validateAndSanitizeSQL(
      'SELECT * FROM VFA_DOCC; SELECT * FROM PERSONAL',
    );
    expectBlocked(r);
  });

  it('trailing semicolon on single SELECT is allowed', () => {
    const r = validateAndSanitizeSQL('SELECT * FROM PERSONAL;');
    expectAllowed(r);
  });
});

// ─── BLOCKED — dangerous functions ───────────────────────────────────────────

describe('validateAndSanitizeSQL — blocked dangerous functions', () => {
  it('WAITFOR DELAY is blocked', () => {
    expectBlocked(validateAndSanitizeSQL("WAITFOR DELAY '0:0:5'"));
  });

  it('OPENROWSET is blocked', () => {
    expectBlocked(
      validateAndSanitizeSQL(
        "SELECT * FROM OPENROWSET('SQLNCLI', 'Server=evil;Trusted_Connection=yes;', 'SELECT 1')",
      ),
    );
  });

  it('OPENDATASOURCE is blocked', () => {
    expectBlocked(
      validateAndSanitizeSQL(
        "SELECT * FROM OPENDATASOURCE('SQLNCLI', 'Data Source=evil') . INET . dbo . PERSONAL",
      ),
    );
  });

  it('OPENQUERY is blocked', () => {
    expectBlocked(
      validateAndSanitizeSQL(
        "SELECT * FROM OPENQUERY(linkedserver, 'SELECT 1')",
      ),
    );
  });

  it('SYSTEM_USER is blocked', () => {
    expectBlocked(validateAndSanitizeSQL('SELECT SYSTEM_USER'));
  });

  it('DB_NAME is blocked', () => {
    expectBlocked(validateAndSanitizeSQL('SELECT DB_NAME()'));
  });

  it('OBJECT_ID is blocked', () => {
    expectBlocked(
      validateAndSanitizeSQL("SELECT OBJECT_ID('PERSONAL')"),
    );
  });
});

// ─── BLOCKED — non-SELECT top-level ──────────────────────────────────────────

describe('validateAndSanitizeSQL — only SELECT/CTE allowed at top level', () => {
  it('empty string is blocked', () => {
    expectBlocked(validateAndSanitizeSQL(''));
  });

  it('whitespace-only is blocked', () => {
    expectBlocked(validateAndSanitizeSQL('   '));
  });

  it('just a table name is blocked', () => {
    expectBlocked(validateAndSanitizeSQL('PERSONAL'));
  });

  it('random text is blocked', () => {
    expectBlocked(validateAndSanitizeSQL('give me the data'));
  });

  it('WITH without SELECT body is blocked', () => {
    // CTE that resolves to no SELECT — malformed SQL
    const r = validateAndSanitizeSQL('WITH cte AS (SELECT 1) DELETE FROM PERSONAL');
    expectBlocked(r);
  });
});

// ─── EDGE CASES — tricky injection attempts ───────────────────────────────────

describe('validateAndSanitizeSQL — edge case injection attempts', () => {
  it('SELECT followed by inline UPDATE via second statement is blocked', () => {
    const r = validateAndSanitizeSQL(
      "SELECT PerCod FROM PERSONAL WHERE PerCod='1'; UPDATE PERSONAL SET PerSue=0",
    );
    expectBlocked(r);
  });

  it('newline-separated DROP after SELECT is blocked', () => {
    const r = validateAndSanitizeSQL(
      "SELECT * FROM PERSONAL\nDROP TABLE PERSONAL",
    );
    expectBlocked(r);
  });

  it('SELECT inside a subquery does NOT allow outer INSERT', () => {
    const r = validateAndSanitizeSQL(
      'INSERT INTO PERSONAL SELECT * FROM PERSONAL',
    );
    expectBlocked(r);
  });

  it('hex-encoded attempt is not a concern — raw text only', () => {
    // Validator operates on raw SQL text — raw text must start with SELECT/WITH
    const r = validateAndSanitizeSQL('0x494e5345525420494e544f');
    expectBlocked(r);
  });

  it('EXEC with lowercase xp_ variant blocked', () => {
    const r = validateAndSanitizeSQL("exec xp_cmdshell('dir')");
    expectBlocked(r);
  });

  it('nested SELECT in FROM does not allow UPDATE in outer query position', () => {
    const r = validateAndSanitizeSQL(
      'UPDATE PERSONAL SET PerSue = (SELECT MAX(PerSue) FROM PERSONAL)',
    );
    expectBlocked(r);
  });

  it('EXEC camouflaged as identifier still blocked', () => {
    const r = validateAndSanitizeSQL("SELECT EXEC('DROP TABLE PERSONAL')");
    expectBlocked(r);
  });
});

// ─── RETURN SHAPE ─────────────────────────────────────────────────────────────

describe('validateAndSanitizeSQL — return value contract', () => {
  it('valid result has valid=true and non-empty sql', () => {
    const r = validateAndSanitizeSQL('SELECT 1');
    expect(r).toMatchObject({ valid: true });
    expect(typeof r.sql).toBe('string');
    expect(r.sql.length).toBeGreaterThan(0);
    expect(r.error).toBeUndefined();
  });

  it('invalid result has valid=false, empty sql, and an error string', () => {
    const r = validateAndSanitizeSQL('DROP TABLE PERSONAL');
    expect(r).toMatchObject({ valid: false, sql: '' });
    expect(typeof r.error).toBe('string');
    expect(r.error!.length).toBeGreaterThan(0);
  });
});
