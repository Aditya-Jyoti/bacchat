import { ModelDownloadManager, type DownloadFetch, type DownloadFs } from '../download';
import { RECOMMENDED_MODELS } from '../registry';

const spec = { ...RECOMMENDED_MODELS[0], sha256: null };

function fs(): DownloadFs {
  const files = new Map<string, number>();
  return {
    stat: async (n) => ({ exists: files.has(n), size: files.get(n) ?? 0 }),
    open: async (n, trunc) => {
      if (trunc) files.set(n, 0);
      return { write: (b) => void files.set(n, (files.get(n) ?? 0) + b.length), close: () => undefined };
    },
    rename: async (a, b) => {
      files.set(b, files.get(a) ?? 0);
      files.delete(a);
    },
    remove: async (n) => void files.delete(n),
    sha256: async () => '',
    list: async () => [...files].map(([name, size]) => ({ name, size })),
    pathOf: (n) => n,
  };
}

function fetcher(): jest.Mock & DownloadFetch {
  return jest.fn(async () => {
    let sent = false;
    return {
      ok: true,
      status: 200,
      headers: { get: (n: string) => (n === 'content-length' ? '4' : null) },
      body: { getReader: () => ({ read: async () => (sent ? { done: true } : ((sent = true), { done: false, value: new Uint8Array(4) })) }) },
    };
  }) as never;
}

describe('Wi-Fi only downloads', () => {
  it('does not fetch on mobile data when Wi-Fi only is on', async () => {
    const f = fetcher();
    const m = new ModelDownloadManager({ fs: fs(), fetch: f, probe: async () => 'cellular', wifiOnly: () => true });
    const s = await m.start(spec);
    expect(s).toMatchObject({ status: 'error', error: 'wifi' });
    expect(f).not.toHaveBeenCalled();
  });

  it('downloads on Wi-Fi, and on mobile data once the preference is off', async () => {
    let only = true;
    const f = fetcher();
    const m = new ModelDownloadManager({ fs: fs(), fetch: f, probe: async () => 'wifi', wifiOnly: () => only });
    expect((await m.start(spec)).status).toBe('done');
    const m2 = new ModelDownloadManager({ fs: fs(), fetch: fetcher(), probe: async () => 'cellular', wifiOnly: () => only });
    only = false;
    expect((await m2.start(spec)).status).toBe('done');
  });

  it('treats a failing probe as allowed', async () => {
    const m = new ModelDownloadManager({ fs: fs(), fetch: fetcher(), probe: async () => Promise.reject(new Error('x')), wifiOnly: () => true });
    expect((await m.start(spec)).status).toBe('done');
  });
});
