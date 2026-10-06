/** In-memory fake of the Drive v3 appDataFolder endpoints the store uses, as a mocked fetch. */
import { createHash } from 'node:crypto';
import type { HttpFetch } from '../target';

interface F {
  id: string;
  name: string;
  body: string;
  createdTime: string;
  modifiedTime: string;
  appProperties: Record<string, string>;
}

export function createDriveFake(opts: { token?: string; before?: (m: string, url: string) => void } = {}) {
  const files = new Map<string, F>();
  const calls: { method: string; url: string; auth: string | undefined }[] = [];
  let n = 0;
  let clock = Date.parse('2026-10-01T00:00:00Z');
  const meta = (f: F) => ({
    id: f.id,
    name: f.name,
    size: String(Buffer.byteLength(f.body)),
    createdTime: f.createdTime,
    modifiedTime: f.modifiedTime,
    md5Checksum: createHash('md5').update(f.body).digest('hex'),
    appProperties: f.appProperties,
  });
  const reply = (status: number, data: unknown) => ({
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => null },
    text: async () => (typeof data === 'string' ? data : JSON.stringify(data ?? {})),
  });
  const fetchFn: HttpFetch = async (url, init) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url, auth: init?.headers?.Authorization });
    opts.before?.(method, url);
    if (init?.headers?.Authorization !== `Bearer ${opts.token ?? 'tok'}`) return reply(401, { error: 'unauthorized' });
    const u = new URL(url);
    const idMatch = /\/files\/([^/?]+)/.exec(u.pathname);
    clock += 1000;
    const stamp = new Date(clock).toISOString();
    if (method === 'GET' && !idMatch) {
      let list = [...files.values()];
      const q = u.searchParams.get('q');
      const nm = q && /name = '([^']*)'/.exec(q);
      if (nm) list = list.filter((f) => f.name === nm[1]);
      list.sort((a, b) => a.createdTime.localeCompare(b.createdTime));
      return reply(200, { files: list.map(meta) });
    }
    if (method === 'GET' && idMatch) {
      const f = files.get(decodeURIComponent(idMatch[1]));
      return f ? reply(200, f.body) : reply(404, {});
    }
    if (method === 'DELETE' && idMatch) {
      return reply(files.delete(decodeURIComponent(idMatch[1])) ? 204 : 404, '');
    }
    const parts = (init?.body ?? '').split(/--bacchat\w+/).filter((p) => p.includes('Content-Type'));
    const part = (i: number): string => parts[i].split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
    if (method === 'POST') {
      const m = JSON.parse(part(0)) as { name: string; appProperties: Record<string, string> };
      const f: F = { id: `id${++n}`, name: m.name, body: part(1), createdTime: stamp, modifiedTime: stamp, appProperties: m.appProperties };
      files.set(f.id, f);
      return reply(200, meta(f));
    }
    if (method === 'PATCH' && idMatch) {
      const f = files.get(decodeURIComponent(idMatch[1]));
      if (!f) return reply(404, {});
      const m = JSON.parse(part(0)) as { appProperties: Record<string, string> };
      f.body = part(1);
      f.appProperties = m.appProperties;
      f.modifiedTime = stamp;
      return reply(200, meta(f));
    }
    return reply(400, {});
  };
  return { fetch: fetchFn, files, calls };
}
