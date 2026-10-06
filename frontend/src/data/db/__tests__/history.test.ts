import { createSqliteDb } from '../sqlite';
import { LATEST_VERSION, MIGRATIONS, currentVersion, runMigrations } from '../schema';
import { factories } from './helpers';
import { createSqlJsDriver } from './sqlJsDriver';

describe.each(factories)('screenshots and asks repositories (%s)', (_n, make) => {
  it('stores screenshot metadata and reads it back', async () => {
    const db = await make();
    const s = await db.screenshots.put({ id: 'shot-1', uri: 'file:///a.png', rowsHash: 'abc', rowCount: 3, readAt: 5, sizeBytes: 100, imageBlob: null });
    expect(await db.screenshots.get('shot-1')).toEqual(s);
    expect((await db.screenshots.changedSince(0)).map((x) => x.id)).toEqual(['shot-1']);
    await db.screenshots.remove('shot-1');
    expect(await db.screenshots.list()).toEqual([]);
    expect((await db.screenshots.changedSince(0))[0].deletedAt).toBeGreaterThan(0);
    await db.close();
  });

  it('stores ask history with tool names and timestamps', async () => {
    const db = await make();
    await db.asks.put({ id: 'ask-1', question: 'Q', answer: 'A', toolNames: ['goals', 'cash_flow'], askedAt: 10, answeredAt: 12 });
    await db.asks.put({ id: 'ask-2', question: 'Q2', answer: '', toolNames: [], askedAt: 20, answeredAt: null });
    const list = await db.asks.list();
    expect(list.map((a) => a.id)).toEqual(['ask-1', 'ask-2']);
    expect(list[0].toolNames).toEqual(['goals', 'cash_flow']);
    expect(list[1].answeredAt).toBeNull();
    await db.close();
  });
});

describe('migration 2 is additive', () => {
  it('upgrades a version 1 database without touching its rows', async () => {
    const d = await createSqlJsDriver();
    expect(await runMigrations(d, MIGRATIONS.filter((m) => m.version === 1))).toBe(1);
    await d.run("INSERT INTO accounts (id, updatedAt, deletedAt, json) VALUES ('a1', 1, NULL, '{\"id\":\"a1\"}')");
    const db = await createSqliteDb(d);
    expect(await currentVersion(d)).toBe(LATEST_VERSION);
    expect(LATEST_VERSION).toBeGreaterThanOrEqual(2);
    expect(await db.accounts.get('a1')).not.toBeNull();
    await db.asks.put({ id: 'x', question: 'q', answer: 'a', toolNames: [], askedAt: 1, answeredAt: 2 });
    expect(await db.asks.list()).toHaveLength(1);
    await db.close();
  });
});
