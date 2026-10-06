import { createSqlJsDriver } from './sqlJsDriver';
import { LATEST_VERSION, MIGRATIONS, currentVersion, runMigrations } from '../schema';
import { createSqliteDb } from '../sqlite';
import { expoSqliteDriver, openBacchatDb, sqlCipherKeyPragma, type ExpoLikeDatabase } from '../expoDriver';

describe('schema migrations', () => {
  it('starts at version 0 and migrates to the latest', async () => {
    const d = await createSqlJsDriver();
    expect(await currentVersion(d)).toBe(0);
    expect(await runMigrations(d)).toBe(LATEST_VERSION);
    expect(await currentVersion(d)).toBe(LATEST_VERSION);
    const tables = (await d.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map((t) => t.name);
    for (const t of ['accounts', 'entries', 'merchants', 'alerts', 'meta', 'holdings', 'upi_ids']) expect(tables).toContain(t);
  });

  it('creates the planned indexes on entries', async () => {
    const d = await createSqlJsDriver();
    await runMigrations(d);
    const idx = (await d.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index'")).map((i) => i.name);
    expect(idx).toEqual(expect.arrayContaining(['idx_entries_at', 'idx_entries_account_at', 'idx_entries_category_at']));
  });

  it('is idempotent and keeps data across reopen', async () => {
    const d = await createSqlJsDriver();
    const db = await createSqliteDb(d);
    await db.categories.put({ id: 'c', name: 'A', icon: 'a' });
    const db2 = await createSqliteDb(d); // migrate again on the same file
    expect(await db2.categories.list()).toHaveLength(1);
  });

  it('applies only newer migrations, in order, and rolls back a failing one', async () => {
    const d = await createSqlJsDriver();
    await runMigrations(d, MIGRATIONS);
    const v2 = { version: LATEST_VERSION + 1, statements: ['CREATE TABLE extra (x INTEGER)'] };
    expect(await runMigrations(d, [...MIGRATIONS, v2])).toBe(LATEST_VERSION + 1);
    const bad = { version: LATEST_VERSION + 2, statements: ['CREATE TABLE half (x INTEGER)', 'THIS IS NOT SQL'] };
    await expect(runMigrations(d, [...MIGRATIONS, v2, bad])).rejects.toBeTruthy();
    expect(await currentVersion(d)).toBe(LATEST_VERSION + 1);
    const names = (await d.all<{ name: string }>("SELECT name FROM sqlite_master WHERE name = 'half'"));
    expect(names).toHaveLength(0);
  });

  it('rejects duplicate migration versions', async () => {
    const d = await createSqlJsDriver();
    await expect(runMigrations(d, [MIGRATIONS[0], MIGRATIONS[0]])).rejects.toThrow('Duplicate');
  });
});

describe('expo-sqlite adapter and SQLCipher key', () => {
  const hex = 'a'.repeat(64);

  it('validates and formats the key pragma', () => {
    expect(sqlCipherKeyPragma(hex)).toBe(`PRAGMA key = "x'${hex}'"`);
    expect(() => sqlCipherKeyPragma('short')).toThrow();
    expect(() => sqlCipherKeyPragma(`${'z'.repeat(64)}`)).toThrow();
    expect(() => sqlCipherKeyPragma(`${hex}'; DROP TABLE x;--`)).toThrow();
  });

  async function fakeExpo(): Promise<{ raw: ExpoLikeDatabase; log: string[] }> {
    const d = await createSqlJsDriver();
    const log: string[] = [];
    const raw: ExpoLikeDatabase = {
      execAsync: async (sql) => {
        log.push(sql);
        if (sql.startsWith('PRAGMA key')) return; // sql.js has no SQLCipher
        await d.exec(sql);
      },
      runAsync: (sql, p) => d.run(sql, p),
      getAllAsync: (sql, p) => d.all(sql, p) as Promise<never>,
      closeAsync: () => d.close(),
    };
    return { raw, log };
  }

  it('sets the key before anything else when a provider returns one', async () => {
    const { raw, log } = await fakeExpo();
    const db = await openBacchatDb({ open: async () => raw, keyProvider: { getKey: async () => hex } });
    expect(log[0]).toBe(sqlCipherKeyPragma(hex));
    expect(log.findIndex((l) => l.includes('CREATE TABLE'))).toBeGreaterThan(0);
    await db.categories.put({ id: 'c', name: 'A', icon: 'a' });
    expect(await db.categories.list()).toHaveLength(1);
  });

  it('opens without a key when there is no provider or it returns null', async () => {
    const a = await fakeExpo();
    await openBacchatDb({ open: async () => a.raw });
    expect(a.log.some((l) => l.startsWith('PRAGMA key'))).toBe(false);
    const b = await fakeExpo();
    await openBacchatDb({ open: async () => b.raw, keyProvider: { getKey: async () => null } });
    expect(b.log.some((l) => l.startsWith('PRAGMA key'))).toBe(false);
  });

  it('adapts expo calls to the driver interface', async () => {
    const calls: unknown[][] = [];
    const drv = expoSqliteDriver({
      execAsync: async (s) => void calls.push(['exec', s]),
      runAsync: async (s, p) => void calls.push(['run', s, p]),
      getAllAsync: async (s, p) => (calls.push(['all', s, p]), [{ a: 1 }]) as never,
      closeAsync: async () => void calls.push(['close']),
    });
    await drv.exec('X');
    await drv.run('Y');
    expect(await drv.all('Z', [1])).toEqual([{ a: 1 }]);
    await drv.close();
    expect(calls).toEqual([['exec', 'X'], ['run', 'Y', []], ['all', 'Z', [1]], ['close']]);
  });
});
