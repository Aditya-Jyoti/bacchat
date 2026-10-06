/** @jest-environment node */
import { createMemoryDb } from '../../data/db';
import { createMemoryStorage, setStorage } from '../../lib/storage';
import { BlobCipher } from '../../lib/sync/crypto';
import { loadNodeSodium } from '../../lib/sync/sodiumNode';
import { createWebDavTarget } from '../../lib/sync/targets/webdav';
import { nodeHttpFetch, startWebDavServer } from '../../lib/sync/__tests__/targetServers';
import { commitImport, EMPTY_DECISIONS, importDefaults, loadPlan, recordScreenshot, rowsFromText, screenshotRowsHash } from '../../screens/money/importFlow';
import { saveAsk, loadAskHistory, ASK_HISTORY_KEEP } from '../askHistory';
import { MAX_SHOT_BYTES, syncShotImages, type ShotFiles } from '../shotImages';
import { createLocalDataSource } from '../syncData';

beforeEach(() => setStorage(createMemoryStorage()));

const DAY = Date.parse('2026-10-05T12:00:00Z');

describe('screenshots and asks as sync data sets', () => {
  it('maps screenshots without the local file path and keeps the path of a row pulled over an existing one', async () => {
    const db = createMemoryDb();
    await db.screenshots.put({ id: 'shot-1', uri: 'file:///private/a.png', rowsHash: 'h', rowCount: 2, readAt: 5, sizeBytes: 9, imageBlob: null });
    const src = createLocalDataSource(db);
    const rows = await src.read('screenshots');
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty('uri');
    expect(rows[0]).toMatchObject({ id: 'shot-1', rowsHash: 'h', rowCount: 2 });
    expect(JSON.stringify(rows)).not.toContain('private');

    await src.write('screenshots', [{ ...rows[0], imageBlob: 'shot-1', updatedAt: '2030-01-01T00:00:00.000Z' }]);
    const after = await db.screenshots.get('shot-1');
    expect(after?.uri).toBe('file:///private/a.png');
    expect(after?.imageBlob).toBe('shot-1');

    await src.write('screenshots', [{ id: 'shot-2', updatedAt: '2030-01-01T00:00:00.000Z', rowsHash: 'z', rowCount: 1, readAt: 1 }]);
    expect((await db.screenshots.get('shot-2'))?.uri).toBe('');
    // A pulled row is not echoed back as a local change.
    expect((await src.read('screenshots')).find((r) => r.id === 'shot-2')?.updatedAt).toBe('2030-01-01T00:00:00.000Z');
  });

  it('maps asks both ways', async () => {
    const a = createMemoryDb();
    await a.asks.put({ id: 'ask-1', question: 'Q', answer: 'A', toolNames: ['goals'], askedAt: 1, answeredAt: 2 });
    const rows = await createLocalDataSource(a).read('asks');
    expect(rows[0]).toMatchObject({ question: 'Q', answer: 'A', toolNames: ['goals'] });
    const b = createMemoryDb();
    await createLocalDataSource(b).write('asks', rows);
    expect((await b.asks.list())[0]).toMatchObject({ id: 'ask-1', question: 'Q', toolNames: ['goals'] });
  });
});

describe('ask history store', () => {
  it('keeps the latest exchanges in order and prunes the oldest', async () => {
    const db = createMemoryDb();
    for (let i = 0; i < ASK_HISTORY_KEEP + 3; i++) await saveAsk(db, { question: `q${i}`, answer: 'a', toolNames: [], askedAt: i, answeredAt: i });
    expect(await db.asks.list()).toHaveLength(ASK_HISTORY_KEEP);
    const last = await loadAskHistory(db, 2);
    expect(last.map((r) => r.question)).toEqual([`q${ASK_HISTORY_KEEP + 1}`, `q${ASK_HISTORY_KEEP + 2}`]);
  });
});

describe('screenshot import records metadata only', () => {
  it('records uri, rows hash and count once, however often the same screenshot is read', async () => {
    const db = createMemoryDb();
    const rows = rowsFromText(['Swiggy  Rs 486  1:42 pm', 'Zomato  Rs 120  2:10 pm'], DAY);
    const hash = screenshotRowsHash(rows);
    expect(hash).toHaveLength(32);
    expect(screenshotRowsHash([...rows].reverse())).toBe(hash);
    await recordScreenshot(db, rows, { uri: 'file:///x.png', readAt: 1 });
    await recordScreenshot(db, rows, { uri: 'file:///x.png', readAt: 2 });
    const list = await db.screenshots.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: `shot-${hash}`, rowsHash: hash, rowCount: 2, uri: 'file:///x.png', readAt: 1 });
    expect(JSON.stringify(list[0])).not.toContain('Swiggy');
  });

  it('commitImport adds the hook only when a shot is given', async () => {
    const db = createMemoryDb();
    const rows = rowsFromText(['Swiggy  Rs 486  1:42 pm'], DAY);
    const loaded = await loadPlan(db, rows);
    const defaults = await importDefaults(db);
    await commitImport(db, loaded, EMPTY_DECISIONS, defaults);
    expect(await db.screenshots.list()).toEqual([]);
    const db2 = createMemoryDb();
    await commitImport(db2, await loadPlan(db2, rows), EMPTY_DECISIONS, await importDefaults(db2), { uri: 'file:///s.png', readAt: 7 });
    expect(await db2.screenshots.list()).toHaveLength(1);
    expect((await db2.entries.list()).length).toBe(1);
  });
});

describe('screenshot image sync', () => {
  function files(initial: Record<string, Uint8Array>) {
    const store = new Map(Object.entries(initial));
    const f: ShotFiles = {
      read: async (uri) => store.get(uri) ?? null,
      save: async (id, bytes) => {
        const uri = `file:///phone/${id}.img`;
        store.set(uri, bytes);
        return uri;
      },
    };
    return { f, store };
  }

  it('uploads each image as its own encrypted blob (under the cap), and another phone downloads it', async () => {
    const sodium = await loadNodeSodium();
    const cipher = new BlobCipher(sodium, sodium.randombytes_buf(32));
    const dav = await startWebDavServer({ user: 'u', pass: 'p' });
    try {
      const target = createWebDavTarget({ url: dav.url, username: 'u', password: 'p' }, 'd1', nodeHttpFetch);
      await target.prepare!();
      const small = Uint8Array.from({ length: 1000 }, (_, i) => i % 251);
      const big = new Uint8Array(MAX_SHOT_BYTES + 1);
      const a = createMemoryDb();
      await a.screenshots.put({ id: 'shot-small', uri: 'file:///a/small.png', rowsHash: 'h1', rowCount: 1, readAt: 1 });
      await a.screenshots.put({ id: 'shot-big', uri: 'file:///a/big.png', rowsHash: 'h2', rowCount: 1, readAt: 1 });
      const fa = files({ 'file:///a/small.png': small, 'file:///a/big.png': big });
      const r1 = await syncShotImages({ target, cipher, db: a, files: fa.f });
      expect(r1).toEqual({ uploaded: 1, downloaded: 0, skippedTooBig: 1 });
      expect((await a.screenshots.get('shot-small'))?.imageBlob).toBe('shot-small');
      expect((await a.screenshots.get('shot-big'))?.imageBlob).toBeFalsy();
      const stored = [...dav.objects.entries()].find(([k]) => k.includes('shot-small'))!;
      expect(stored[1].body).not.toContain(Buffer.from(small).toString('base64'));
      // Second run does not upload again.
      expect((await syncShotImages({ target, cipher, db: a, files: fa.f })).uploaded).toBe(0);

      // Another phone received the metadata row (no uri) and fetches the bytes.
      const b = createMemoryDb();
      await b.screenshots.put({ id: 'shot-small', uri: '', rowsHash: 'h1', rowCount: 1, readAt: 1, imageBlob: 'shot-small' });
      const fb = files({});
      const t2 = createWebDavTarget({ url: dav.url, username: 'u', password: 'p' }, 'd2', nodeHttpFetch);
      const r2 = await syncShotImages({ target: t2, cipher, db: b, files: fb.f });
      expect(r2.downloaded).toBe(1);
      const got = await b.screenshots.get('shot-small');
      expect(Array.from(fb.store.get(got!.uri)!)).toEqual(Array.from(small));
    } finally {
      await dav.stop();
    }
  });
});
