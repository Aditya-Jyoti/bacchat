/** @jest-environment node */
import { BlobCipher, FAST_TEST_KDF, WrongPassphraseError, type SodiumLike } from '../crypto';
import { PayloadTooLargeError, SyncClient } from '../client';
import type { DataSetName, SyncRecord } from '../merge';
import {
  MemorySyncStateStore,
  SyncEngine,
  enabledBlobs,
  DEFAULT_SYNC_OPTIONS,
  type LocalDataSource,
  type SyncProgress,
  type SyncOptions,
} from '../engine';
import { changePassphrase, createPairing, joinDevice, startSync, unlockSync } from '../setup';
import { loadNodeSodium } from '../sodiumNode';
import { backendAvailable, nodeFetch, startBackend, type RunningBackend } from './backendHelper';

class MemData implements LocalDataSource {
  sets = new Map<DataSetName, SyncRecord[]>();
  async read(name: DataSetName) {
    return (this.sets.get(name) ?? []).map((r) => ({ ...r }));
  }
  async write(name: DataSetName, records: SyncRecord[]) {
    this.sets.set(name, records.map((r) => ({ ...r })));
  }
  get(name: DataSetName, id: string) {
    return (this.sets.get(name) ?? []).find((r) => r.id === id);
  }
}

const rec = (id: string, extra: Record<string, unknown> = {}, at = '2026-10-01T10:00:00.000Z'): SyncRecord => ({
  id,
  updatedAt: at,
  ...extra,
});

const avail = backendAvailable();
const suite = avail.ok ? describe : describe.skip;
if (!avail.ok) {
  console.warn(`Skipping sync engine integration tests: ${avail.reason}`);
}

suite('SyncEngine against the real backend', () => {
  let backend: RunningBackend;
  let sodium: SodiumLike;

  beforeAll(async () => {
    sodium = await loadNodeSodium();
    backend = await startBackend({ MAX_BLOB_BYTES: '200000' });
  }, 40000);
  afterAll(async () => {
    await backend?.stop();
  });

  async function deviceA(options?: Partial<SyncOptions>) {
    const client = new SyncClient({ baseUrl: backend.baseUrl, fetch: nodeFetch });
    const start = await startSync(client, sodium, { deviceName: 'Phone A', passphrase: 'correct horse', kdf: FAST_TEST_KDF });
    return { client, start, ...mk(client, start.masterKey, options) };
  }
  function mk(client: SyncClient, key: Uint8Array, options?: Partial<SyncOptions>, extra: { progress?: SyncProgress[] } = {}) {
    const data = new MemData();
    const state = new MemorySyncStateStore();
    const engine = new SyncEngine({
      client,
      cipher: new BlobCipher(sodium, key),
      data,
      state,
      options: { ...DEFAULT_SYNC_OPTIONS, wifiOnly: false, ...options },
      onProgress: (p) => extra.progress?.push(p),
    });
    return { data, state, engine };
  }
  async function deviceB(a: { client: SyncClient }, passphrase = 'correct horse', options?: Partial<SyncOptions>) {
    const pairing = await createPairing(a.client);
    const client = new SyncClient({ baseUrl: backend.baseUrl, fetch: nodeFetch });
    await joinDevice(client, 'Phone B', pairing.code);
    const key = await unlockSync(client, sodium, { passphrase });
    return { client, ...mk(client, key, options) };
  }

  it('two devices: A pushes, B pairs and pulls, both edit, conflict is detected and resolved', async () => {
    const A = await deviceA();
    A.data.sets.set('entries', [rec('e1', { name: 'Chai', paise: 2000 }), rec('e2', { name: 'Auto', paise: 8000 })]);
    A.data.sets.set('goals', [rec('g1', { name: 'Trip' })]);
    const first = await A.engine.sync();
    expect(first.status).toBe('synced');
    expect(first.pushed.sort()).toEqual(['entries', 'goals']);

    // Nothing changed: nothing is pushed.
    expect((await A.engine.sync()).pushed).toEqual([]);

    const B = await deviceB(A);
    const events: SyncProgress[] = [];
    const B2 = mk(B.client, (await unlockSync(B.client, sodium, { passphrase: 'correct horse' })), {}, { progress: events });
    const pulled = await B2.engine.sync();
    expect(pulled.status).toBe('synced');
    expect(pulled.pulled.sort()).toEqual(['entries', 'goals']);
    expect(B2.data.get('entries', 'e1')?.name).toBe('Chai');
    expect(events[0].phase).toBe('checking');
    expect(events[events.length - 1]).toMatchObject({ phase: 'done', percent: 100 });
    expect(events.map((e) => e.percent)).toEqual([...events.map((e) => e.percent)].sort((x, y) => x - y));

    // Both edit e1 differently; A also edits e2 (no clash); B adds e3.
    A.data.sets.set('entries', [
      rec('e1', { name: 'Chai', paise: 2500 }, '2026-10-02T09:00:00.000Z'),
      rec('e2', { name: 'Auto ride', paise: 8000 }, '2026-10-02T09:00:00.000Z'),
    ]);
    B2.data.sets.set('entries', [
      rec('e1', { name: 'Chai', paise: 3000 }, '2026-10-02T11:00:00.000Z'),
      rec('e2', { name: 'Auto', paise: 8000 }),
      rec('e3', { name: 'Lunch', paise: 12000 }),
    ]);
    expect((await A.engine.sync()).status).toBe('synced'); // A is first, pushes cleanly

    const clash = await B2.engine.sync();
    expect(clash.status).toBe('conflicts');
    expect(clash.conflicts).toHaveLength(1);
    const c = clash.conflicts[0];
    expect(c).toMatchObject({ blob: 'entries', recordId: 'e1', changedFields: ['paise', 'updatedAt'] });
    expect(c.a.record?.paise).toBe(3000); // this phone (B)
    expect(c.b.record?.paise).toBe(2500); // other phone (A)
    expect(c.b.deviceName).toBe('Phone A');
    expect(c.a.deviceName).toBe('Phone B');
    // Clean rows already merge on resolution; nothing written locally until then.
    expect(B2.engine.hasUnresolvedConflicts()).toBe(true);

    // Syncing again without a choice keeps waiting.
    expect((await B2.engine.sync()).status).toBe('conflicts');

    B2.engine.resolve(c.id, 'both');
    const done = await B2.engine.sync();
    expect(done.status).toBe('synced');
    expect(B2.data.get('entries', 'e1')?.paise).toBe(2500);
    expect(B2.data.get('entries', 'e1~copy')?.paise).toBe(3000);
    expect(B2.data.get('entries', 'e2')?.name).toBe('Auto ride');
    expect(B2.data.get('entries', 'e3')?.name).toBe('Lunch');

    // A picks up B's resolution.
    await A.engine.sync();
    expect(A.data.get('entries', 'e1~copy')?.paise).toBe(3000);
    expect(A.data.get('entries', 'e3')?.name).toBe('Lunch');
  }, 60000);

  it('last-writer-wins resolves by newest edit, deletions count as edits', async () => {
    const A = await deviceA();
    A.data.sets.set('goals', [rec('g1', { name: 'Bike' }), rec('g2', { name: 'Phone' })]);
    await A.engine.sync();
    const B = await deviceB(A);
    await B.engine.sync();

    A.data.sets.set('goals', [
      rec('g1', { name: 'Bike (A)' }, '2026-10-03T08:00:00.000Z'),
      rec('g2', { name: 'Phone', deletedAt: '2026-10-03T08:00:00.000Z' }, '2026-10-03T08:00:00.000Z'),
    ]);
    B.data.sets.set('goals', [
      rec('g1', { name: 'Bike (B)' }, '2026-10-03T12:00:00.000Z'),
      rec('g2', { name: 'Phone 2' }, '2026-10-03T07:00:00.000Z'),
    ]);
    await A.engine.sync();
    const r = await B.engine.sync();
    expect(r.conflicts.map((c) => c.recordId).sort()).toEqual(['g1', 'g2']);
    B.engine.resolveAll('newest');
    expect((await B.engine.sync()).status).toBe('synced');
    expect(B.data.get('goals', 'g1')?.name).toBe('Bike (B)');
    expect(B.data.get('goals', 'g2')?.deletedAt).toBeTruthy();
    await A.engine.sync();
    expect(A.data.get('goals', 'g1')?.name).toBe('Bike (B)');
  }, 60000);

  it('conflictPolicy newest resolves without asking', async () => {
    const A = await deviceA();
    A.data.sets.set('budgets', [rec('b1', { limit: 1 })]);
    await A.engine.sync();
    const B = await deviceB(A);
    await B.engine.sync();
    A.data.sets.set('budgets', [rec('b1', { limit: 2 }, '2026-10-04T00:00:00.000Z')]);
    B.data.sets.set('budgets', [rec('b1', { limit: 3 }, '2026-10-05T00:00:00.000Z')]);
    await A.engine.sync();
    const auto = new SyncEngine({
      client: B.client,
      cipher: (B.engine as any).deps.cipher,
      data: B.data,
      state: B.state,
      options: { ...DEFAULT_SYNC_OPTIONS, wifiOnly: false },
      conflictPolicy: 'newest',
    });
    expect((await auto.sync()).status).toBe('synced');
    expect(B.data.get('budgets', 'b1')?.limit).toBe(3);
  }, 60000);

  it('respects the K25 flags: screenshots and asks are off by default', async () => {
    expect(enabledBlobs(DEFAULT_SYNC_OPTIONS).sort()).toEqual(
      ['accounts', 'budgets', 'categories', 'entries', 'goals', 'rules'],
    );
    const A = await deviceA();
    A.data.sets.set('screenshots', [rec('s1', { bytes: 'AAAA' })]);
    A.data.sets.set('rules', [rec('r1', { merchant: 'Amazon' })]);
    await A.engine.sync();
    const names = (await A.client.listBlobs()).blobs.map((b) => b.name).sort();
    expect(names).toContain('rules');
    expect(names).not.toContain('screenshots');
    expect(names).toContain('keyring');

    const withShots = mk(A.client, A.start.masterKey, { shots: true });
    withShots.data.sets.set('screenshots', [rec('s1', { bytes: 'AAAA' })]);
    await withShots.engine.sync();
    expect((await A.client.listBlobs()).blobs.map((b) => b.name)).toContain('screenshots');
  }, 60000);

  it('server only holds ciphertext', async () => {
    const A = await deviceA();
    A.data.sets.set('entries', [rec('e1', { name: 'VerySecretMerchantName' })]);
    await A.engine.sync();
    const blob = await A.client.getBlob('entries');
    expect(Buffer.from(blob!.ciphertext).toString('latin1')).not.toContain('VerySecretMerchantName');
    expect(blob!.nonce.length).toBe(24);
  }, 30000);

  it('wrong passphrase on a second device fails; recovery key and passphrase change work', async () => {
    const A = await deviceA();
    const pairing = await createPairing(A.client);
    const client = new SyncClient({ baseUrl: backend.baseUrl, fetch: nodeFetch });
    await joinDevice(client, 'Phone B', pairing.code);
    await expect(unlockSync(client, sodium, { passphrase: 'nope nope' })).rejects.toThrow(WrongPassphraseError);
    const viaRecovery = await unlockSync(client, sodium, { recoveryKey: A.start.recoveryKey });
    expect(Buffer.from(viaRecovery).equals(Buffer.from(A.start.masterKey))).toBe(true);
    await changePassphrase(A.client, sodium, A.start.masterKey, 'brand new phrase', FAST_TEST_KDF);
    await expect(unlockSync(client, sodium, { passphrase: 'correct horse' })).rejects.toThrow(WrongPassphraseError);
    await unlockSync(client, sodium, { passphrase: 'brand new phrase' });
  }, 30000);

  it('a pairing code is single use; devices can be listed and revoked', async () => {
    const A = await deviceA();
    const p = await createPairing(A.client);
    const c1 = new SyncClient({ baseUrl: backend.baseUrl, fetch: nodeFetch });
    await joinDevice(c1, 'B', p.code);
    const c2 = new SyncClient({ baseUrl: backend.baseUrl, fetch: nodeFetch });
    await expect(joinDevice(c2, 'C', p.code)).rejects.toMatchObject({ status: 403 });
    const devices = await A.client.listDevices();
    expect(devices.map((d) => d.name).sort()).toEqual(['B', 'Phone A']);
    const b = devices.find((d) => d.name === 'B')!;
    await A.client.deleteDevice(b.id);
    await expect(c1.listBlobs()).rejects.toMatchObject({ status: 401 });
  }, 30000);

  it('maps an oversized blob to PayloadTooLargeError', async () => {
    const A = await deviceA();
    A.data.sets.set('entries', [rec('big', { blob: 'x'.repeat(400000) })]);
    await expect(A.engine.sync()).rejects.toBeInstanceOf(PayloadTooLargeError);
  }, 30000);

  it('deleting the account removes access', async () => {
    const A = await deviceA();
    await A.client.deleteAccount();
    await expect(A.client.listBlobs()).rejects.toMatchObject({ status: 401 });
  }, 30000);
});

describe('SyncEngine network gate (no server needed)', () => {
  const client = { listBlobs: jest.fn(async () => { throw new Error('should not be called'); }) } as unknown as SyncClient;
  const mkEngine = (net: 'wifi' | 'cellular' | 'none', wifiOnly: boolean) =>
    new SyncEngine({
      client,
      cipher: null as unknown as BlobCipher,
      data: new MemData(),
      state: new MemorySyncStateStore(),
      options: { ...DEFAULT_SYNC_OPTIONS, wifiOnly },
      probe: async () => net,
    });

  it('waits for Wi-Fi when Wi-Fi only is on, without any request', async () => {
    expect((await mkEngine('cellular', true).sync()).status).toBe('waiting-for-wifi');
    expect(client.listBlobs).not.toHaveBeenCalled();
  });
  it('reports offline when there is no network', async () => {
    expect((await mkEngine('none', false).sync()).status).toBe('offline');
  });
  it('lets cellular through when Wi-Fi only is off', async () => {
    await expect(mkEngine('cellular', false).sync()).rejects.toThrow('should not be called');
  });
});
