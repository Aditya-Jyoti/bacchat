/** @jest-environment node */
import {
  NetworkError,
  PayloadTooLargeError,
  SyncClient,
  SyncHttpError,
  UnauthorizedError,
  VersionConflictError,
  type FetchLike,
} from '../client';

function mock(responses: ({ status: number; body?: unknown } | Error)[]) {
  const calls: { url: string; init: any }[] = [];
  const fetchFn: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const r = responses.shift()!;
    if (r instanceof Error) throw r;
    return { status: r.status, ok: r.status < 300, text: async () => (r.body === undefined ? '' : JSON.stringify(r.body)) };
  };
  return { calls, client: new SyncClient({ baseUrl: 'https://x.test/', fetch: fetchFn, token: 'tok' }) };
}

describe('SyncClient', () => {
  it('registers with a pairing code and keeps the token', async () => {
    const { client, calls } = mock([{ status: 201, body: { accountId: 'a', deviceId: 'd', token: 'newtok' } }]);
    const c = await client.register('Pixel', 'PAIRCODE12345');
    expect(c.token).toBe('newtok');
    expect(calls[0].url).toBe('https://x.test/v1/register');
    expect(JSON.parse(calls[0].init.body)).toEqual({ deviceName: 'Pixel', pairingCode: 'PAIRCODE12345' });
    expect(calls[0].init.headers.Authorization).toBeUndefined();
  });

  it('sends base64 and bearer on put, and returns the version', async () => {
    const { client, calls } = mock([{ status: 200, body: { version: 3, updatedAt: 't' } }]);
    const r = await client.putBlob('entries', {
      baseVersion: 2,
      ciphertext: new Uint8Array([1, 2, 3]),
      nonce: new Uint8Array(24),
    });
    expect(r.version).toBe(3);
    expect(calls[0].init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(calls[0].init.body).ciphertext).toBe('AQID');
  });

  it('maps 409 to VersionConflictError with the server version', async () => {
    const { client } = mock([
      { status: 409, body: { error: 'version_conflict', message: 'm', serverVersion: 5, serverUpdatedAt: 'u' } },
    ]);
    const err = await client.putBlob('a', { baseVersion: 1, ciphertext: new Uint8Array(1), nonce: new Uint8Array(24) }).catch((e) => e);
    expect(err).toBeInstanceOf(VersionConflictError);
    expect(err.serverVersion).toBe(5);
  });

  it('maps 413 to PayloadTooLargeError for size and storage cap', async () => {
    const { client } = mock([
      { status: 413, body: { error: 'blob_too_large', message: 'big' } },
      { status: 413, body: { error: 'storage_cap_exceeded', message: 'full', capBytes: 10, usedBytes: 9 } },
    ]);
    const put = () => client.putBlob('a', { baseVersion: 0, ciphertext: new Uint8Array(1), nonce: new Uint8Array(24) });
    const e1 = await put().catch((e) => e);
    const e2 = await put().catch((e) => e);
    expect(e1).toBeInstanceOf(PayloadTooLargeError);
    expect(e1.isStorageCap).toBe(false);
    expect(e2.isStorageCap).toBe(true);
    expect(e2.capBytes).toBe(10);
  });

  it('returns null on 404, maps 401 and network failures', async () => {
    const { client } = mock([
      { status: 404, body: { error: 'not_found', message: 'n' } },
      { status: 401, body: { error: 'unauthorized', message: 'u' } },
      new TypeError('fetch failed'),
      { status: 500, body: { error: 'internal', message: 'oops' } },
    ]);
    expect(await client.getBlob('x')).toBeNull();
    await expect(client.listBlobs()).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(client.listDevices()).rejects.toBeInstanceOf(NetworkError);
    await expect(client.deleteAccount()).rejects.toBeInstanceOf(SyncHttpError);
  });

  it('decodes a blob download and lists devices', async () => {
    const { client } = mock([
      { status: 200, body: { version: 1, ciphertext: 'AQID', nonce: 'A'.repeat(32), meta: null, updatedAt: 't', deviceId: 'd' } },
      { status: 200, body: { devices: [{ id: 'd', name: 'n', createdAt: 'c', lastSeenAt: null, current: true }] } },
    ]);
    const b = await client.getBlob('entries');
    expect(Array.from(b!.ciphertext)).toEqual([1, 2, 3]);
    expect(b!.nonce.length).toBe(24);
    expect((await client.listDevices())[0].current).toBe(true);
  });
});
