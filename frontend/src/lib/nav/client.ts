import { parseAmfiNav } from './amfi';
import { parseNpsNav } from './nps';
import { NavError, type NavFetch, type NavTable } from './types';

export const DEFAULT_AMFI_URL = 'https://www.amfiindia.com/spages/NAVAll.txt';
/** NPS NAV publication. The exact file name changes; the app should let this be configured. */
export const DEFAULT_NPS_URL = 'https://www.npstrust.org.in/nav-file';
export const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;

export type CachedText = { text: string; fetchedAt: number };

/** Where raw NAV text is kept between runs. The app can back this with the key-value store. */
export interface NavCache {
  get(key: string): Promise<CachedText | null>;
  set(key: string, value: CachedText): Promise<void>;
}

export function createMemoryNavCache(): NavCache {
  const m = new Map<string, CachedText>();
  return {
    async get(k) {
      return m.get(k) ?? null;
    },
    async set(k, v) {
      m.set(k, v);
    },
  };
}

export type NavClientOptions = {
  fetch: NavFetch;
  cache?: NavCache;
  now?: () => number;
  ttlMs?: number;
  amfiUrl?: string;
  npsUrl?: string;
};

export type NavResult = {
  table: NavTable;
  fetchedAt: number;
  /** True when the network failed and an older copy was used. */
  stale: boolean;
  /** True when served from cache without a request. */
  fromCache: boolean;
};

/**
 * Anonymous NAV fetcher with a TTL cache. Requests are plain GETs: no cookies, no auth, no body, and
 * only an Accept header, so nothing identifies the user or the device.
 */
export function createNavClient(opts: NavClientOptions) {
  const cache = opts.cache ?? createMemoryNavCache();
  const now = opts.now ?? Date.now;
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
  const urls = { amfi: opts.amfiUrl ?? DEFAULT_AMFI_URL, nps: opts.npsUrl ?? DEFAULT_NPS_URL };
  const memo = new Map<string, { fetchedAt: number; table: NavTable }>();

  async function get(source: 'amfi' | 'nps', force = false): Promise<NavResult> {
    const key = `nav.${source}`;
    const cached = await cache.get(key);
    const t = now();
    const parse = (c: { text: string; fetchedAt: number }): NavTable => {
      const hit = memo.get(key);
      if (hit && hit.fetchedAt === c.fetchedAt) return hit.table;
      const table = source === 'amfi' ? parseAmfiNav(c.text) : parseNpsNav(c.text);
      memo.set(key, { fetchedAt: c.fetchedAt, table });
      return table;
    };
    if (cached && !force && t - cached.fetchedAt < ttl && t >= cached.fetchedAt) {
      return { table: parse(cached), fetchedAt: cached.fetchedAt, stale: false, fromCache: true };
    }
    try {
      const res = await opts.fetch(urls[source], {
        method: 'GET',
        headers: { Accept: 'text/plain, text/csv, text/html' },
        credentials: 'omit',
      });
      if (!res.ok) throw new NavError('http', `NAV request failed with status ${res.status}`, res.status);
      const text = await res.text();
      const fresh = { text, fetchedAt: t };
      const table = source === 'amfi' ? parseAmfiNav(text) : parseNpsNav(text);
      if (table.records.length === 0) throw new NavError('parse', 'NAV file had no usable rows');
      memo.set(key, { fetchedAt: t, table });
      await cache.set(key, fresh);
      return { table, fetchedAt: t, stale: false, fromCache: false };
    } catch (e) {
      if (cached) {
        return { table: parse(cached), fetchedAt: cached.fetchedAt, stale: true, fromCache: true };
      }
      if (e instanceof NavError) throw e;
      throw new NavError('offline', e instanceof Error ? e.message : 'Network request failed');
    }
  }

  return {
    getAmfi: (force = false) => get('amfi', force),
    getNps: (force = false) => get('nps', force),
  };
}

export type NavClient = ReturnType<typeof createNavClient>;
