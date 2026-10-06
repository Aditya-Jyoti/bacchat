/** @jest-environment node */
import { VersionConflictError, NetworkError, UnauthorizedError } from '../client';
import type { SyncTarget } from '../target';
import { createDriveTarget, type AccessTokenProvider } from '../targets/gdrive';
import { createS3Target } from '../targets/s3';
import { createWebDavTarget } from '../targets/webdav';
import { createDriveFake } from './driveFake';
import { nodeHttpFetch, startS3Server, startWebDavServer, type FakeS3, type FakeServer } from './targetServers';

const bytes = (...n: number[]): Uint8Array => Uint8Array.from(n);

/** The behaviour every target must share. `fresh` makes a new instance on the same storage (a second phone). */
function contract(name: string, setup: () => Promise<{ fresh: (deviceId: string) => SyncTarget; stop: () => Promise<void> }>) {
  describe(`${name} target`, () => {
    let env: Awaited<ReturnType<typeof setup>>;
    let a: SyncTarget;
    let b: SyncTarget;
    beforeEach(async () => {
      env = await setup();
      a = env.fresh('dev-a');
      b = env.fresh('dev-b');
      await a.prepare?.();
    });
    afterEach(async () => {
      await env.stop();
    });

    it('has no accounts or pairing', () => {
      expect(a.capabilities.register).toBe(false);
      expect(a.capabilities.pairing).toBe(false);
    });

    it('starts empty, creates a blob at version 1 and reads it back', async () => {
      expect((await a.listBlobs()).blobs).toEqual([]);
      expect(await a.getBlob('entries')).toBeNull();
      const r = await a.putBlob('entries', { baseVersion: 0, ciphertext: bytes(1, 2, 3), nonce: bytes(9, 9), meta: { n: 1 } });
      expect(r.version).toBe(1);
      const got = await b.getBlob('entries');
      expect(got?.version).toBe(1);
      expect(Array.from(got!.ciphertext)).toEqual([1, 2, 3]);
      expect(Array.from(got!.nonce)).toEqual([9, 9]);
      expect(got!.deviceId).toBe('dev-a');
      expect(got!.meta).toEqual({ n: 1 });
    });

    it('lists versions, also from a phone that never read them', async () => {
      await a.putBlob('entries', { baseVersion: 0, ciphertext: bytes(1), nonce: bytes(1) });
      await a.putBlob('entries', { baseVersion: 1, ciphertext: bytes(2), nonce: bytes(1) });
      await a.putBlob('goals', { baseVersion: 0, ciphertext: bytes(3), nonce: bytes(1) });
      const list = await b.listBlobs();
      expect(list.blobs.map((x) => [x.name, x.version]).sort()).toEqual([
        ['entries', 2],
        ['goals', 1],
      ]);
      expect(list.usedBytes).toBeGreaterThan(0);
    });

    it('rejects a stale baseVersion with the server version', async () => {
      await a.putBlob('entries', { baseVersion: 0, ciphertext: bytes(1), nonce: bytes(1) });
      await b.listBlobs();
      await a.putBlob('entries', { baseVersion: 1, ciphertext: bytes(2), nonce: bytes(1) });
      const err = await b.putBlob('entries', { baseVersion: 1, ciphertext: bytes(3), nonce: bytes(1) }).catch((e) => e);
      expect(err).toBeInstanceOf(VersionConflictError);
      expect(err.serverVersion).toBe(2);
      expect(Array.from((await a.getBlob('entries'))!.ciphertext)).toEqual([2]);
    });

    it('rejects creating a blob that already exists', async () => {
      await a.putBlob('entries', { baseVersion: 0, ciphertext: bytes(1), nonce: bytes(1) });
      const err = await b.putBlob('entries', { baseVersion: 0, ciphertext: bytes(2), nonce: bytes(1) }).catch((e) => e);
      expect(err).toBeInstanceOf(VersionConflictError);
      expect(err.serverVersion).toBe(1);
    });

    it('lets exactly one of two racing writers win', async () => {
      await a.putBlob('entries', { baseVersion: 0, ciphertext: bytes(1), nonce: bytes(1) });
      await a.getBlob('entries');
      await b.getBlob('entries');
      const results = await Promise.allSettled([
        a.putBlob('entries', { baseVersion: 1, ciphertext: bytes(2), nonce: bytes(1) }),
        b.putBlob('entries', { baseVersion: 1, ciphertext: bytes(3), nonce: bytes(1) }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(lost.reason).toBeInstanceOf(VersionConflictError);
      expect((await a.getBlob('entries'))!.version).toBe(2);
    });

    it('lets exactly one of two racing creators win', async () => {
      const results = await Promise.allSettled([
        a.putBlob('goals', { baseVersion: 0, ciphertext: bytes(2), nonce: bytes(1) }),
        b.putBlob('goals', { baseVersion: 0, ciphertext: bytes(3), nonce: bytes(1) }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
      expect((await a.listBlobs()).blobs).toHaveLength(1);
    });

    it('keeps writing after its own successful put (cached etag)', async () => {
      await a.putBlob('entries', { baseVersion: 0, ciphertext: bytes(1), nonce: bytes(1) });
      const r2 = await a.putBlob('entries', { baseVersion: 1, ciphertext: bytes(2), nonce: bytes(1) });
      const r3 = await a.putBlob('entries', { baseVersion: 2, ciphertext: bytes(3), nonce: bytes(1) });
      expect([r2.version, r3.version]).toEqual([2, 3]);
    });

    it('deletes a blob and tolerates deleting a missing one', async () => {
      await a.putBlob('entries', { baseVersion: 0, ciphertext: bytes(1), nonce: bytes(1) });
      await a.deleteBlob('entries');
      await a.deleteBlob('entries');
      expect(await b.getBlob('entries')).toBeNull();
      expect((await b.listBlobs()).blobs).toEqual([]);
    });
  });
}

let dav: FakeServer;
contract('WebDAV (real HTTP)', async () => {
  dav = await startWebDavServer({ user: 'me', pass: 'p@ss:word' });
  return {
    fresh: (id) => createWebDavTarget({ url: dav.url, username: 'me', password: 'p@ss:word', folder: 'Bacchat' }, id, nodeHttpFetch),
    stop: () => dav.stop(),
  };
});

let s3: FakeS3;
contract('S3 (real HTTP, SigV4)', async () => {
  s3 = await startS3Server({ bucket: 'bk', maxKeysPerPage: 1 });
  return {
    fresh: (id) => createS3Target({ endpoint: s3.url, bucket: 'bk', ...s3.creds }, id, nodeHttpFetch),
    stop: () => s3.stop(),
  };
});

let drive: ReturnType<typeof createDriveFake>;
contract('Google Drive (mocked fetch)', async () => {
  drive = createDriveFake();
  const tokens: AccessTokenProvider = { getAccessToken: async () => 'tok' };
  return { fresh: (id) => createDriveTarget(tokens, id, drive.fetch), stop: async () => undefined };
});

describe('WebDAV specifics', () => {
  it('makes the folder with MKCOL once and finds it afterwards', async () => {
    const s = await startWebDavServer({ user: 'u', pass: 'p' });
    try {
      const t = createWebDavTarget({ url: s.url, username: 'u', password: 'p' }, 'd', nodeHttpFetch);
      await t.prepare!();
      await t.prepare!();
      expect(s.folders.has('/dav/Bacchat')).toBe(true);
      expect(s.requests.filter((r) => r.method === 'MKCOL')).toHaveLength(1);
    } finally {
      await s.stop();
    }
  });

  it('sends Basic auth and maps a wrong password to UnauthorizedError', async () => {
    const s = await startWebDavServer({ user: 'u', pass: 'p' });
    try {
      const t = createWebDavTarget({ url: s.url, username: 'u', password: 'wrong' }, 'd', nodeHttpFetch);
      await expect(t.prepare!()).rejects.toBeInstanceOf(UnauthorizedError);
    } finally {
      await s.stop();
    }
  });

  it('sends If-None-Match on create and If-Match on replace', async () => {
    const s = await startWebDavServer({ user: 'u', pass: 'p' });
    try {
      const t = createWebDavTarget({ url: s.url, username: 'u', password: 'p' }, 'd', nodeHttpFetch);
      await t.prepare!();
      await t.putBlob('entries', { baseVersion: 0, ciphertext: bytes(1), nonce: bytes(1) });
      await t.putBlob('entries', { baseVersion: 1, ciphertext: bytes(2), nonce: bytes(1) });
      const puts = s.requests.filter((r) => r.method === 'PUT');
      expect(puts[0].headers['if-none-match']).toBe('*');
      expect(puts[1].headers['if-match']).toMatch(/^"/);
    } finally {
      await s.stop();
    }
  });

  it('asks for the ETag when the server leaves it out of a PUT reply', async () => {
    const s = await startWebDavServer({ user: 'u', pass: 'p', omitPutEtag: true });
    try {
      const t = createWebDavTarget({ url: s.url, username: 'u', password: 'p' }, 'd', nodeHttpFetch);
      await t.prepare!();
      await t.putBlob('entries', { baseVersion: 0, ciphertext: bytes(1), nonce: bytes(1) });
      expect(s.requests.some((r) => r.method === 'HEAD')).toBe(true);
      await t.putBlob('entries', { baseVersion: 1, ciphertext: bytes(2), nonce: bytes(1) });
    } finally {
      await s.stop();
    }
  });

  it('reports an unreachable server as NetworkError', async () => {
    const t = createWebDavTarget({ url: 'http://127.0.0.1:1', username: 'u', password: 'p' }, 'd', nodeHttpFetch);
    await expect(t.listBlobs()).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('S3 specifics', () => {
  it('signs every request and uses conditional headers', async () => {
    const s = await startS3Server({ bucket: 'bk' });
    try {
      const t = createS3Target({ endpoint: s.url, bucket: 'bk', ...s.creds }, 'd', nodeHttpFetch);
      await t.prepare!();
      await t.putBlob('entries', { baseVersion: 0, ciphertext: bytes(1), nonce: bytes(1) });
      await t.putBlob('entries', { baseVersion: 1, ciphertext: bytes(2), nonce: bytes(1) });
      expect(s.requests.every((r) => String(r.headers.authorization).startsWith('AWS4-HMAC-SHA256 Credential=minioadmin/'))).toBe(true);
      const puts = s.requests.filter((r) => r.method === 'PUT');
      expect(puts[0].headers['if-none-match']).toBe('*');
      expect(puts[1].headers['if-match']).toMatch(/^"[0-9a-f]{32}"$/);
      expect([...s.objects.keys()]).toEqual(['bacchat/entries.bacchat']);
    } finally {
      await s.stop();
    }
  });

  it('maps wrong keys to UnauthorizedError and a missing bucket to a clear error', async () => {
    const s = await startS3Server({ bucket: 'bk' });
    try {
      const bad = createS3Target({ endpoint: s.url, bucket: 'bk', ...s.creds, secretAccessKey: 'nope' }, 'd', nodeHttpFetch);
      await expect(bad.prepare!()).rejects.toBeInstanceOf(UnauthorizedError);
      const nob = createS3Target({ endpoint: s.url, bucket: 'other', ...s.creds }, 'd', nodeHttpFetch);
      await expect(nob.prepare!()).rejects.toThrow(/bucket/);
    } finally {
      await s.stop();
    }
  });
});

describe('Google Drive specifics', () => {
  it('only uses the appDataFolder space and the bearer token', async () => {
    const d = createDriveFake();
    const t = createDriveTarget({ getAccessToken: async () => 'tok' }, 'd', d.fetch);
    await t.putBlob('entries', { baseVersion: 0, ciphertext: bytes(1), nonce: bytes(1) });
    await t.listBlobs();
    expect(d.calls.every((c) => c.auth === 'Bearer tok')).toBe(true);
    expect(d.calls.filter((c) => c.method === 'GET').every((c) => c.url.includes('spaces=appDataFolder'))).toBe(true);
    expect([...d.files.values()].map((f) => f.name)).toEqual(['entries.v1.bacchat']);
  });

  it('keeps one file per blob: a replace writes the next version and removes the old one', async () => {
    const d = createDriveFake();
    const t = createDriveTarget({ getAccessToken: async () => 'tok' }, 'd', d.fetch);
    await t.putBlob('entries', { baseVersion: 0, ciphertext: bytes(1), nonce: bytes(1) });
    await t.putBlob('entries', { baseVersion: 1, ciphertext: bytes(2), nonce: bytes(1) });
    expect([...d.files.values()].map((f) => f.name)).toEqual(['entries.v2.bacchat']);
  });

  it('refreshes the token once after a 401, then gives up with UnauthorizedError', async () => {
    const d = createDriveFake({ token: 'good' });
    let current = 'stale';
    let invalidated = 0;
    const t = createDriveTarget(
      {
        getAccessToken: async () => current,
        invalidate: () => {
          invalidated++;
          current = 'good';
        },
      },
      'd',
      d.fetch,
    );
    expect((await t.listBlobs()).blobs).toEqual([]);
    expect(invalidated).toBe(1);
    const dead = createDriveTarget({ getAccessToken: async () => 'never' }, 'd', d.fetch);
    await expect(dead.listBlobs()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('lists versions from app properties without downloading', async () => {
    const d = createDriveFake();
    const t = createDriveTarget({ getAccessToken: async () => 'tok' }, 'd', d.fetch);
    await t.putBlob('entries', { baseVersion: 0, ciphertext: bytes(1), nonce: bytes(1) });
    const fresh = createDriveTarget({ getAccessToken: async () => 'tok' }, 'e', d.fetch);
    d.calls.length = 0;
    expect((await fresh.listBlobs()).blobs[0].version).toBe(1);
    expect(d.calls.some((c) => c.url.includes('alt=media'))).toBe(false);
  });
});
