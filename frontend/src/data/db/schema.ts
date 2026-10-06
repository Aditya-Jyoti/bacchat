import type { SqlDriver } from './driver';

/**
 * Schema versions. Never edit a released migration: append a new one.
 * The version is kept in PRAGMA user_version.
 *
 * Layout: each table keeps the whole record as JSON next to a few indexed columns. That keeps
 * migrations small (new optional model fields need no SQL) while range queries on entries stay fast.
 */
export type Migration = { version: number; statements: string[] };

const plain = (t: string): string =>
  `CREATE TABLE IF NOT EXISTS ${t} (id TEXT PRIMARY KEY NOT NULL, updatedAt INTEGER NOT NULL, deletedAt INTEGER, json TEXT NOT NULL)`;

export const TABLES = [
  'accounts',
  'debts',
  'categories',
  'goals',
  'allocations',
  'budgets',
  'recurring',
  'upi_ids',
  'holdings',
] as const;

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      ...TABLES.map(plain),
      `CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY NOT NULL, updatedAt INTEGER NOT NULL, deletedAt INTEGER, json TEXT NOT NULL,
        at INTEGER NOT NULL, accountId TEXT, categoryId TEXT, status TEXT NOT NULL)`,
      'CREATE INDEX IF NOT EXISTS idx_entries_at ON entries (at)',
      'CREATE INDEX IF NOT EXISTS idx_entries_account_at ON entries (accountId, at)',
      'CREATE INDEX IF NOT EXISTS idx_entries_category_at ON entries (categoryId, at)',
      `CREATE TABLE IF NOT EXISTS merchants (
        id TEXT PRIMARY KEY NOT NULL, updatedAt INTEGER NOT NULL, deletedAt INTEGER, json TEXT NOT NULL,
        key TEXT NOT NULL)`,
      'CREATE INDEX IF NOT EXISTS idx_merchants_key ON merchants (key)',
      `CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY NOT NULL, updatedAt INTEGER NOT NULL, deletedAt INTEGER, json TEXT NOT NULL,
        categoryId TEXT NOT NULL, month TEXT NOT NULL)`,
      'CREATE INDEX IF NOT EXISTS idx_alerts_cat_month ON alerts (categoryId, month)',
      'CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL)',
    ],
  },
  {
    // Additive: history sets that sync but had no local table yet.
    version: 2,
    statements: [plain('screenshots'), plain('asks'), 'CREATE INDEX IF NOT EXISTS idx_asks_at ON asks (updatedAt)'],
  },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export async function currentVersion(driver: SqlDriver): Promise<number> {
  const rows = await driver.all<{ user_version: number }>('PRAGMA user_version');
  return rows[0]?.user_version ?? 0;
}

/** Apply every migration newer than the stored version, each in its own transaction. Returns the new version. */
export async function runMigrations(driver: SqlDriver, migrations: Migration[] = MIGRATIONS): Promise<number> {
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].version === sorted[i - 1].version) throw new Error(`Duplicate migration ${sorted[i].version}`);
  }
  let version = await currentVersion(driver);
  for (const m of sorted) {
    if (m.version <= version) continue;
    await driver.exec('BEGIN');
    try {
      for (const s of m.statements) await driver.exec(s);
      await driver.exec(`PRAGMA user_version = ${m.version}`);
      await driver.exec('COMMIT');
    } catch (e) {
      await driver.exec('ROLLBACK');
      throw e;
    }
    version = m.version;
  }
  return version;
}
