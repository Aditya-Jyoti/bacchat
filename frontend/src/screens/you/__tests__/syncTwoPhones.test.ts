/** @jest-environment node */
import { createMemoryDb } from '../../../data/db';
import { createMemoryStorage, setStorage } from '../../../lib/storage';
import { usePreferences } from '../../../lib/preferences';
import { FAST_TEST_KDF } from '../../../lib/sync/crypto';
import { loadNodeSodium } from '../../../lib/sync/sodiumNode';
import { backendAvailable, nodeFetch, startBackend, type RunningBackend } from '../../../lib/sync/__tests__/backendHelper';
import { createMemorySecureStore, createTestServices, type Services } from '../../../services';
import { joinWithCode, makePairingCode, startFirstDevice } from '../sync/actions';
import type { SyncDeps } from '../sync/deps';
import { setServerUrl } from '../sync/server';

const avail = backendAvailable();
const suite = avail.ok ? describe : describe.skip;

const deps = (name: string): SyncDeps => ({ fetch: nodeFetch, loadSodium: loadNodeSodium, kdf: FAST_TEST_KDF, deviceName: () => name });

suite('two phones through the sync screens actions against the real backend', () => {
  let backend: RunningBackend;
  beforeAll(async () => {
    backend = await startBackend();
  }, 40000);
  afterAll(async () => {
    await backend?.stop();
  });

  it('syncs one phone to another, then resolves an edit conflict with engine.resolve', async () => {
    const storeA = createMemoryStorage();
    const storeB = createMemoryStorage();
    const mk = (seed: boolean): Services =>
      createTestServices({ secure: createMemorySecureStore(), db: createMemoryDb(), seed, syncFetch: nodeFetch, sodium: loadNodeSodium });
    const a = mk(true);
    const b = mk(false);
    // The sync bookkeeping lives in one global key-value store, so each phone gets its own while it runs.
    const as = async <T>(store: ReturnType<typeof createMemoryStorage>, fn: () => Promise<T>): Promise<T> => {
      setStorage(store);
      return fn();
    };

    await setServerUrl(a.secure, backend.baseUrl);
    await setServerUrl(b.secure, backend.baseUrl);
    await a.whenReady();

    const recovery = await as(storeA, () => startFirstDevice(a, deps('Phone A'), 'correct horse battery'));
    expect(recovery.length).toBeGreaterThan(10);
    const ha = (await a.getSync())!;
    const r1 = await as(storeA, () => ha.run());
    expect(r1?.status).toBe('synced');
    expect(r1?.pushed).toContain('entries');

    const { code } = await makePairingCode(ha);
    await as(storeB, () => joinWithCode(b, deps('Phone B'), { code, secret: { passphrase: 'correct horse battery' } }));
    usePreferences.setState({ syncEnabled: true });
    const hb = (await b.getSync())!;
    const r2 = await as(storeB, () => hb.run());
    expect(r2?.status).toBe('synced');
    const entriesA = await a.db.entries.list();
    const entriesB = await b.db.entries.list();
    expect(entriesB.length).toBe(entriesA.length);
    expect((await ha.client.listDevices()).length).toBe(2);

    // Both phones edit the same entry.
    const target = entriesA[0];
    await a.db.entries.put({ ...target, amountPaise: target.amountPaise + 100 } as never);
    await new Promise((r) => setTimeout(r, 20));
    await b.db.entries.put({ ...entriesB[0], amountPaise: target.amountPaise + 200 } as never);
    const r3 = await as(storeA, () => ha.run());
    expect(r3?.status).toBe('synced');
    const r4 = await as(storeB, () => hb.run());
    expect(r4?.status).toBe('conflicts');
    expect(r4?.conflicts).toHaveLength(1);
    hb.engine.resolve(r4!.conflicts[0].id, 'remote');
    const r5 = await as(storeB, () => hb.run());
    expect(r5?.status).toBe('synced');
    const final = (await b.db.entries.list()).find((e) => e.id === target.id)!;
    expect(final.amountPaise).toBe(target.amountPaise + 100);
  }, 60000);
});
