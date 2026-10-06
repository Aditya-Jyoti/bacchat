import { ModelDownloadManager, type DownloadFs, type DownloadFetch, type DownloadResponse, type DownloadState } from '../download';
import { DEFAULT_MODEL_ID, ModelRegistry, RECOMMENDED_MODELS, type ModelSpec } from '../registry';
import { Sha256 } from '../sha256';

const GB = 1024 ** 3;

describe('ModelRegistry', () => {
  it('describes the recommended models completely', () => {
    const reg = new ModelRegistry();
    expect(reg.list().length).toBeGreaterThanOrEqual(5);
    for (const m of RECOMMENDED_MODELS) {
      expect(m.fileName.endsWith('.gguf')).toBe(true);
      expect(m.downloadUrl.startsWith('https://')).toBe(true);
      expect(m.license).toBeTruthy();
      expect(m.sizeBytes).toBeGreaterThan(100 * 1024 * 1024);
      expect(m.ramBytes).toBeGreaterThan(m.sizeBytes);
      expect(['chatml', 'llama3', 'gemma', 'phi3']).toContain(m.template);
    }
    expect(new Set(RECOMMENDED_MODELS.map((m) => m.id)).size).toBe(RECOMMENDED_MODELS.length);
    expect(reg.get(DEFAULT_MODEL_ID)?.name).toContain('Qwen');
    expect(reg.get('nope')).toBeUndefined();
    expect(reg.get(null)).toBeUndefined();
  });
  it('fits and suggests by RAM', () => {
    const reg = new ModelRegistry();
    expect(reg.suggest(null).id).toBe(DEFAULT_MODEL_ID);
    expect(reg.suggest(8 * GB).id).toBe(DEFAULT_MODEL_ID);
    expect(reg.suggest(2 * GB).tier).toBe('tiny');
    expect(reg.suggest(1 * GB).tier).toBe('tiny');
    expect(reg.fitting(3 * GB).every((m) => m.ramBytes <= 3 * GB)).toBe(true);
    expect(reg.fitting(null).some((m) => m.tier === 'medium')).toBe(false);
    expect(reg.byFileName('Llama-3.2-1B-Instruct-Q4_K_M.gguf')?.template).toBe('llama3');
  });
});

// ---- download manager with a fake file system and fetch ----

function makeFs(initial: Record<string, Uint8Array> = {}, free = Number.MAX_SAFE_INTEGER) {
  const files = new Map<string, Uint8Array>(Object.entries(initial));
  const fs: DownloadFs = {
    freeBytes: async () => free,
    stat: async (n) => ({ exists: files.has(n), size: files.get(n)?.length ?? 0 }),
    open: async (n, truncate) => {
      if (truncate || !files.has(n)) files.set(n, new Uint8Array(0));
      return {
        write: (b) => {
          const cur = files.get(n)!;
          const next = new Uint8Array(cur.length + b.length);
          next.set(cur);
          next.set(b, cur.length);
          files.set(n, next);
        },
        close: () => undefined,
      };
    },
    rename: async (a, b) => {
      files.set(b, files.get(a)!);
      files.delete(a);
    },
    remove: async (n) => {
      files.delete(n);
    },
    sha256: async (n) => new Sha256().update(files.get(n)!).hex(),
    list: async () => [...files].map(([name, v]) => ({ name, size: v.length })),
    pathOf: (n) => `/files/models/${n}`,
  };
  return { fs, files };
}

const bytes = (n: number, seed = 1): Uint8Array => Uint8Array.from({ length: n }, (_, i) => (i * 7 + seed) & 0xff);

function makeFetch(data: Uint8Array, o: { ignoreRange?: boolean; status?: number; chunk?: number; failAfter?: number; hold?: Promise<void> } = {}) {
  const calls: { url: string; headers?: Record<string, string> }[] = [];
  const f: DownloadFetch = async (url, init) => {
    calls.push({ url, headers: init.headers });
    if (o.status && o.status !== 200) return { ok: false, status: o.status, headers: { get: () => null } } as DownloadResponse;
    const range = /bytes=(\d+)-/.exec(init.headers?.Range ?? '');
    const start = range && !o.ignoreRange ? Number(range[1]) : 0;
    if (range && start >= data.length && !o.ignoreRange) return { ok: false, status: 416, headers: { get: () => null } };
    const part = data.subarray(start);
    const headers: Record<string, string> = range && !o.ignoreRange ? { 'content-range': `bytes ${start}-${data.length - 1}/${data.length}`, 'content-length': String(part.length) } : { 'content-length': String(part.length) };
    let pos = 0;
    return {
      ok: true,
      status: range && !o.ignoreRange ? 206 : 200,
      headers: { get: (n) => headers[n.toLowerCase()] ?? null },
      body: {
        getReader: () => ({
          read: async () => {
            if (o.hold && pos > 0) await o.hold;
            if (init.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
            if (o.failAfter != null && pos >= o.failAfter) throw new Error('network lost');
            if (pos >= part.length) return { done: true };
            const v = part.subarray(pos, pos + (o.chunk ?? 100));
            pos += v.length;
            return { done: false, value: v };
          },
        }),
      },
    };
  };
  return { f, calls };
}

const spec = (data: Uint8Array, sha = true): ModelSpec => ({
  ...RECOMMENDED_MODELS[0],
  id: 't',
  fileName: 't.gguf',
  sizeBytes: data.length,
  downloadUrl: 'https://example.invalid/t.gguf',
  sha256: sha ? new Sha256().update(data).hex() : null,
});

describe('ModelDownloadManager', () => {
  it('downloads, reports progress, verifies and installs', async () => {
    const data = bytes(1000);
    const { fs, files } = makeFs();
    const { f } = makeFetch(data);
    const m = new ModelDownloadManager({ fs, fetch: f, progressStep: 0.1 });
    const events: DownloadState[] = [];
    m.subscribe((s) => events.push(s));
    const end = await m.start(spec(data));
    expect(end).toMatchObject({ status: 'done', receivedBytes: 1000, totalBytes: 1000, fraction: 1, unverified: false });
    expect(files.get('t.gguf')).toEqual(data);
    expect(files.has('t.gguf.part')).toBe(false);
    expect(events.map((e) => e.status)).toEqual(expect.arrayContaining(['downloading', 'verifying', 'done']));
    const fractions = events.filter((e) => e.status === 'downloading').map((e) => e.fraction);
    expect(fractions).toEqual([...fractions].sort((a, b) => a - b));
    expect(events.length).toBeLessThan(25);
    expect(await m.isInstalled(spec(data))).toBe(true);
    expect(await m.installed([spec(data)])).toEqual([{ id: 't', fileName: 't.gguf', sizeBytes: 1000, path: '/files/models/t.gguf' }]);
  });

  it('resumes from a partial file with a Range request', async () => {
    const data = bytes(1000);
    const { fs, files } = makeFs({ 't.gguf.part': data.subarray(0, 400) });
    const { f, calls } = makeFetch(data);
    const end = await new ModelDownloadManager({ fs, fetch: f }).start(spec(data));
    expect(calls[0].headers?.Range).toBe('bytes=400-');
    expect(end.status).toBe('done');
    expect(files.get('t.gguf')).toEqual(data);
  });

  it('starts over when the server ignores Range', async () => {
    const data = bytes(500);
    const { fs, files } = makeFs({ 't.gguf.part': bytes(200, 9) });
    const { f } = makeFetch(data, { ignoreRange: true });
    expect((await new ModelDownloadManager({ fs, fetch: f }).start(spec(data))).status).toBe('done');
    expect(files.get('t.gguf')).toEqual(data);
  });

  it('starts over on 416', async () => {
    const data = bytes(300);
    const { fs, files } = makeFs({ 't.gguf.part': bytes(300, 5) });
    const { f, calls } = makeFetch(data);
    expect((await new ModelDownloadManager({ fs, fetch: f }).start(spec(data))).status).toBe('done');
    expect(calls).toHaveLength(2);
    expect(files.get('t.gguf')).toEqual(data);
  });

  it('rejects a file whose checksum is wrong and deletes it', async () => {
    const data = bytes(400);
    const { fs, files } = makeFs();
    const { f } = makeFetch(data);
    const bad = { ...spec(data), sha256: 'a'.repeat(64) };
    const end = await new ModelDownloadManager({ fs, fetch: f }).start(bad);
    expect(end).toMatchObject({ status: 'error', error: 'checksum' });
    expect(files.size).toBe(0);
  });

  it('marks an unpinned checksum as unverified', async () => {
    const data = bytes(100);
    const { fs } = makeFs();
    const end = await new ModelDownloadManager({ fs, fetch: makeFetch(data).f }).start(spec(data, false));
    expect(end).toMatchObject({ status: 'done', unverified: true });
  });

  it('keeps the partial file on a network drop, so the next start resumes', async () => {
    const data = bytes(1000);
    const { fs, files } = makeFs();
    const m = new ModelDownloadManager({ fs, fetch: makeFetch(data, { failAfter: 300 }).f });
    expect(await m.start(spec(data))).toMatchObject({ status: 'error', error: 'network' });
    expect(files.get('t.gguf.part')!.length).toBe(300);
    const m2 = new ModelDownloadManager({ fs, fetch: makeFetch(data).f });
    expect((await m2.start(spec(data))).status).toBe('done');
    expect(files.get('t.gguf')).toEqual(data);
  });

  it('reports incomplete, http and space errors', async () => {
    const data = bytes(1000);
    const short = bytes(600);
    const { fs } = makeFs();
    const lying: DownloadFetch = async () => ({ ok: true, status: 200, headers: { get: (n) => (n === 'content-length' ? '1000' : null) }, body: makeFetch(short).f ? (await makeFetch(short).f('x', {})).body : null });
    expect(await new ModelDownloadManager({ fs, fetch: lying }).start(spec(data))).toMatchObject({ status: 'error', error: 'incomplete' });
    expect(await new ModelDownloadManager({ fs: makeFs().fs, fetch: makeFetch(data, { status: 403 }).f }).start(spec(data))).toMatchObject({ error: 'http' });
    expect(await new ModelDownloadManager({ fs: makeFs({}, 100).fs, fetch: makeFetch(data).f }).start(spec(data))).toMatchObject({ error: 'space' });
  });

  it('pause keeps the partial file; cancel discards it', async () => {
    const data = bytes(1000);
    let release: () => void = () => undefined;
    const hold = new Promise<void>((r) => {
      release = r;
    });
    const { fs, files } = makeFs();
    const m = new ModelDownloadManager({ fs, fetch: makeFetch(data, { hold }).f });
    const run = m.start(spec(data));
    await new Promise((r) => setTimeout(r, 5));
    m.pause('t');
    release();
    expect((await run).status).toBe('paused');
    expect(files.has('t.gguf.part')).toBe(true);

    const hold2 = new Promise<void>((r) => {
      release = r;
    });
    const m2 = new ModelDownloadManager({ fs, fetch: makeFetch(data, { hold: hold2 }).f });
    const run2 = m2.start(spec(data));
    await new Promise((r) => setTimeout(r, 5));
    m2.cancel('t');
    release();
    expect((await run2).status).toBe('idle');
    expect(files.has('t.gguf.part')).toBe(false);
  });

  it('start on an installed model is done at once; remove deletes files', async () => {
    const data = bytes(50);
    const { fs, files } = makeFs({ 't.gguf': data });
    const { f, calls } = makeFetch(data);
    const m = new ModelDownloadManager({ fs, fetch: f });
    expect((await m.start(spec(data))).status).toBe('done');
    expect(calls).toHaveLength(0);
    await m.remove(spec(data));
    expect(files.size).toBe(0);
    expect(m.state('t').status).toBe('idle');
  });

  it('ignores a second start while one is running', async () => {
    const data = bytes(300);
    const { fs } = makeFs();
    const { f, calls } = makeFetch(data);
    const m = new ModelDownloadManager({ fs, fetch: f });
    const [a, b] = await Promise.all([m.start(spec(data)), m.start(spec(data))]);
    expect(calls).toHaveLength(1);
    expect(a.status).toBe('done');
    expect(['downloading', 'verifying', 'done', 'idle']).toContain(b.status);
  });
});
