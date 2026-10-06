/** @jest-environment node */
import { createMemoryDb, seedIfEmpty } from '../../data/db';
import { createMemoryStorage, setStorage } from '../../lib/storage';
import { usePreferences } from '../../lib/preferences';
import { FAST_TEST_KDF } from '../../lib/sync/crypto';
import type { FetchLike } from '../../lib/sync/client';
import { loadNodeSodium } from '../../lib/sync/sodiumNode';
import { startSync } from '../../lib/sync/setup';
import { SyncClient } from '../../lib/sync/client';
import { createLocalDataSource, createSyncStateStore, createTestServices, createMemorySecureStore, observeDb } from '..';

/** A tiny in-memory Bacchat Cloud: register, list, get and put blobs. */
function fakeCloud(): FetchLike {
  const blobs = new Map<string, { version: number; ciphertext: string; nonce: string }>();
  const json = (status: number, body: unknown) => ({ status, ok: status < 300, text: async () => JSON.stringify(body) });
  return async (url, init) => {
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    const method = init?.method ?? 'GET';
    if (method === 'POST' && path === '/v1/register') return json(200, { accountId: 'acct', deviceId: 'dev', token: 'tok' });
    if (method === 'GET' && path === '/v1/blobs') {
      return json(200, {
        blobs: [...blobs].map(([name, b]) => ({ name, version: b.version, updatedAt: 'now', size: b.ciphertext.length })),
        usedBytes: 0,
        capBytes: 1e9,
      });
    }
    if (method === 'GET' && path === '/v1/devices') return json(200, { devices: [] });
    const m = /^\/v1\/blobs\/(.+)$/.exec(path);
    if (m) {
      const name = decodeURIComponent(m[1]);
      if (method === 'GET') {
        const b = blobs.get(name);
        return b ? json(200, { ...b, updatedAt: 'now', deviceId: 'dev', meta: null }) : json(404, { error: 'not_found' });
      }
      if (method === 'PUT') {
        const body = JSON.parse(init!.body!) as { baseVersion: number; ciphertext: string; nonce: string };
        const cur = blobs.get(name)?.version ?? 0;
        if (body.baseVersion !== cur) return json(409, { error: 'version_conflict', serverVersion: cur });
        blobs.set(name, { version: cur + 1, ciphertext: body.ciphertext, nonce: body.nonce });
        return json(200, { version: cur + 1, updatedAt: 'now' });
      }
    }
    return json(404, { error: 'not_found' });
  };
}

beforeEach(() => {
  setStorage(createMemoryStorage());
  usePreferences.setState({ syncEnabled: false });
});

describe('LocalDataSource', () => {
  it('reads repository rows as ISO sync records with tombstones', async () => {
    const db = createMemoryDb();
    await seedIfEmpty(db);
    await db.categories.remove('groceries');
    const ds = createLocalDataSource(db);
    const cats = await ds.read('categories');
    const g = cats.find((r) => r.id === 'groceries')!;
    expect(g.deletedAt).toEqual(expect.stringMatching(/^\d{4}-/));
    expect(cats.find((r) => r.id === 'bills')!.deletedAt).toBeNull();
    expect(typeof cats[0].updatedAt).toBe('string');
    expect((await ds.read('entries')).length).toBeGreaterThan(30);
    expect(await ds.read('screenshots')).toEqual([]);
    expect(await ds.read('asks')).toEqual([]);
  });

  it('groups related tables into accounts and goals with prefixed ids', async () => {
    const db = createMemoryDb();
    await seedIfEmpty(db);
    const ds = createLocalDataSource(db);
    const accounts = await ds.read('accounts');
    expect(accounts.some((r) => r._t === 'debts' && r.id.startsWith('debts:'))).toBe(true);
    expect(accounts.some((r) => r._t === 'holdings')).toBe(true);
    expect(accounts.some((r) => r._t === 'accounts' && r.id === 'accounts:acc-hdfc')).toBe(true);
    const goals = await ds.read('goals');
    expect(goals.some((r) => r._t === 'allocations')).toBe(true);
    expect(goals.some((r) => r._t === 'recurring')).toBe(true);
    expect((await ds.read('rules')).length).toBeGreaterThan(0);
  });

  it('writes remote rows, applies tombstones and does not echo them back', async () => {
    const db = createMemoryDb();
    await seedIfEmpty(db);
    const ds = createLocalDataSource(db);
    const local = await ds.read('accounts');
    const remoteTime = '2030-01-01T00:00:00.000Z';
    const edited = local.map((r) =>
      r.id === 'accounts:acc-hdfc' ? { ...r, name: 'HDFC Renamed', updatedAt: remoteTime } : r,
    );
    const gone = edited.map((r) => (r.id === 'debts:debt-icici' ? { ...r, updatedAt: remoteTime, deletedAt: remoteTime } : r));
    const fresh = {
      id: 'accounts:acc-new',
      _t: 'accounts',
      name: 'Remote',
      kind: 'cash',
      balancePaise: 100,
      icon: 'payments',
      updatedAt: remoteTime,
      deletedAt: null,
    };
    await ds.write('accounts', [...gone, fresh]);
    expect((await db.accounts.get('acc-hdfc'))?.name).toBe('HDFC Renamed');
    expect(await db.debts.get('debt-icici')).toBeNull();
    expect((await db.accounts.get('acc-new'))?.balancePaise).toBe(100);
    // Reading back gives the remote timestamps, so nothing looks changed.
    const back = await ds.read('accounts');
    expect(back.find((r) => r.id === 'accounts:acc-hdfc')!.updatedAt).toBe(remoteTime);
    expect(back.find((r) => r.id === 'debts:debt-icici')!.deletedAt).toBe(remoteTime);
    const again = createLocalDataSource(db); // reloads the applied map from storage
    const back2 = await again.read('accounts');
    expect(back2.find((r) => r.id === 'accounts:acc-new')!.updatedAt).toBe(remoteTime);
  });

  it('writes unprefixed single-table sets', async () => {
    const db = createMemoryDb();
    const ds = createLocalDataSource(db);
    await ds.write('budgets', [{ id: 'b1', updatedAt: '2030-01-01T00:00:00.000Z', deletedAt: null, categoryId: 'c', monthlyPaise: 500 }]);
    expect((await db.budgets.get('b1'))?.monthlyPaise).toBe(500);
  });
});

describe('SyncStateStore', () => {
  it('persists per data set in the key-value store', async () => {
    const st = createSyncStateStore();
    expect(await st.get('entries')).toBeNull();
    await st.set('entries', { version: 3, base: [{ id: 'a', updatedAt: 'x' }] });
    expect(await st.get('entries')).toEqual({ version: 3, base: [{ id: 'a', updatedAt: 'x' }] });
    expect(await st.get('goals')).toBeNull();
  });
});

describe('getSync factory', () => {
  it('is null when sync is off or not configured', async () => {
    const s = createTestServices({ seed: false });
    expect(await s.getSync()).toBeNull();
    s.settings.setSyncEnabled(true);
    expect(await s.getSync()).toBeNull();
  });

  it('builds client and engine from stored config and syncs through a fake cloud', async () => {
    const sodium = await loadNodeSodium();
    const fetch = fakeCloud();
    const bootstrap = new SyncClient({ baseUrl: 'https://cloud.test', fetch });
    const start = await startSync(bootstrap, sodium, { deviceName: 'A', passphrase: 'correct horse', kdf: FAST_TEST_KDF });

    const a = createTestServices({ syncFetch: fetch, sodium: async () => sodium, secure: createMemorySecureStore() });
    await a.whenReady();
    await a.settings.setSyncConfig({
      baseUrl: 'https://cloud.test',
      token: start.credentials.token,
      deviceId: start.credentials.deviceId,
      masterKey: start.masterKey,
    });
    const handle = (await a.getSync())!;
    expect(handle).not.toBeNull();
    expect(await a.getSync()).toBe(handle);
    const result = await handle.run();
    expect(result?.status).toBe('synced');
    expect(result?.pushed).toEqual(expect.arrayContaining(['entries', 'accounts', 'goals', 'categories', 'budgets', 'rules']));
    expect(result?.pushed).not.toContain('screenshots');

    // A second phone with an empty db and its own bookkeeping pulls everything.
    setStorage(createMemoryStorage());
    const bdb = observeDb(createMemoryDb());
    const b = createTestServices({ db: bdb, seed: false, syncFetch: fetch, sodium: async () => sodium });
    await b.settings.setSyncConfig({
      baseUrl: 'https://cloud.test',
      token: start.credentials.token,
      deviceId: 'dev-b',
      masterKey: start.masterKey,
    });
    const hb = (await b.getSync())!;
    const pulled = await hb.run();
    expect(pulled?.status).toBe('synced');
    expect((await bdb.accounts.list()).map((x) => x.name)).toContain('HDFC Savings');
    expect((await bdb.entries.list()).length).toBe((await a.db.entries.list()).length);
    expect((await bdb.debts.list()).length).toBe(2);

    // Nothing changed: the next run pushes nothing.
    const again = await hb.run();
    expect(again?.pushed).toEqual([]);
    expect(again?.pulled).toEqual([]);

    // Turning sync off drops the handle.
    b.settings.setSyncEnabled(false);
    expect(await b.getSync()).toBeNull();
  });
});
