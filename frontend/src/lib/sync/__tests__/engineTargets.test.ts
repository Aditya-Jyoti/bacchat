/** @jest-environment node */
import { BlobCipher, FAST_TEST_KDF, type SodiumLike } from '../crypto';
import { MemorySyncStateStore, SyncEngine, type LocalDataSource } from '../engine';
import type { DataSetName, SyncRecord } from '../merge';
import { startSync, unlockSync } from '../setup';
import { loadNodeSodium } from '../sodiumNode';
import type { SyncTarget } from '../target';
import { createS3Target } from '../targets/s3';
import { createWebDavTarget } from '../targets/webdav';
import { nodeHttpFetch, startS3Server, startWebDavServer } from './targetServers';

class MemData implements LocalDataSource {
  sets = new Map<DataSetName, SyncRecord[]>();
  async read(name: DataSetName) {
    return (this.sets.get(name) ?? []).map((r) => ({ ...r }));
  }
  async write(name: DataSetName, records: SyncRecord[]) {
    this.sets.set(name, records.map((r) => ({ ...r })));
  }
}

async function twoPhones(sodium: SodiumLike, mk: (deviceId: string) => SyncTarget) {
  const a = mk('phone-a');
  const start = await startSync(a, sodium, { deviceName: 'Phone A', deviceId: 'phone-a', passphrase: 'correct horse', kdf: FAST_TEST_KDF });
  expect(start.credentials.token).toBe('');
  const b = mk('phone-b');
  const key = await unlockSync(b, sodium, { passphrase: 'correct horse' });
  expect(Array.from(key)).toEqual(Array.from(start.masterKey));
  const engine = (t: SyncTarget, k: Uint8Array) => {
    const data = new MemData();
    return { data, engine: new SyncEngine({ client: t, cipher: new BlobCipher(sodium, k), data, state: new MemorySyncStateStore() }) };
  };
  return { A: engine(a, start.masterKey), B: engine(b, key) };
}

describe.each([
  ['WebDAV', async () => {
    const s = await startWebDavServer({ user: 'u', pass: 'p' });
    return { stop: s.stop, mk: (id: string) => createWebDavTarget({ url: s.url, username: 'u', password: 'p' }, id, nodeHttpFetch), raw: () => [...s.objects.values()].map((o) => o.body) };
  }],
  ['S3', async () => {
    const s = await startS3Server({ bucket: 'bk' });
    return { stop: s.stop, mk: (id: string) => createS3Target({ endpoint: s.url, bucket: 'bk', ...s.creds }, id, nodeHttpFetch), raw: () => [...s.objects.values()].map((o) => o.body) };
  }],
])('SyncEngine over %s', (_n, setup) => {
  it('syncs two phones, merges, and stores only ciphertext', async () => {
    const sodium = await loadNodeSodium();
    const env = await setup();
    try {
      const { A, B } = await twoPhones(sodium, env.mk);
      A.data.sets.set('entries', [{ id: 'e1', updatedAt: '2026-10-01T10:00:00.000Z', merchant: 'Chai Point Secret' }]);
      expect((await A.engine.sync()).pushed).toContain('entries');
      const rb = await B.engine.sync();
      expect(rb.pulled).toContain('entries');
      expect(B.data.sets.get('entries')?.[0].merchant).toBe('Chai Point Secret');
      B.data.sets.set('entries', [...B.data.sets.get('entries')!, { id: 'e2', updatedAt: '2026-10-02T10:00:00.000Z', merchant: 'Auto' }]);
      await B.engine.sync();
      await A.engine.sync();
      expect(A.data.sets.get('entries')?.map((r) => r.id).sort()).toEqual(['e1', 'e2']);
      for (const body of env.raw()) expect(body).not.toContain('Chai Point');
    } finally {
      await env.stop();
    }
  });
});
