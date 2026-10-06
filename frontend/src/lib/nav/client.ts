import { parseAmfiNav } from './amfi';
import { parseNpsNav } from './nps';
import { NavError, type NavFetch, type NavTable } from './types';

export const DEFAULT_AMFI_URL = 'https://www.amfiindia.com/spages/NAVAll.txt';
/**
 * Built-in NPS NAV source. NOT verified against the live site (the build sandbox cannot reach it) and
 * the publisher has changed file names before, so it is a setting: usePreferences().npsNavUrl, or
 * app.json extra.npsNavUrl for a build-wide default. The URL may contain {YYYY}, {MM}, {DD} and
 * {DDMMYYYY}, filled with today's local date, for sources that publish one file per day.
 */
export const DEFAULT_NPS_URL = 'https://www.npstrust.org.in/nav-file';

export function isValidNavUrl(url: string): boolean {
  return /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(url.trim());
}

/** Fills {YYYY} {MM} {DD} {DDMMYYYY} with the local date of `at` (epoch ms). */
export function expandNavUrl(template: string, at: number): string {
  const d = new Date(at);
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return template.replace(/\{YYYY\}/g, yyyy).replace(/\{MM\}/g, mm).replace(/\{DD\}/g, dd).replace(/\{DDMMYYYY\}/g, `${dd}${mm}${yyyy}`);
}
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
  /** The NPS source, or a getter so a changed setting applies on the next request. Empty means DEFAULT_NPS_URL. */
  npsUrl?: string | (() => string | undefined);
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
  const urlFor = (source: 'amfi' | 'nps'): string => {
    if (source === 'amfi') return opts.amfiUrl ?? DEFAULT_AMFI_URL;
    const given = typeof opts.npsUrl === 'function' ? opts.npsUrl() : opts.npsUrl;
    return expandNavUrl(given && isValidNavUrl(given) ? given.trim() : DEFAULT_NPS_URL, now());
  };
  const memo = new Map<string, { fetchedAt: number; table: NavTable }>();

  async function get(source: 'amfi' | 'nps', force = false): Promise<NavResult> {
    const url = urlFor(source);
    // A different source URL is a different cache entry, so changing the setting never serves old rows.
    const key = source === 'nps' ? `nav.nps@${url}` : `nav.${source}`;
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
      const res = await opts.fetch(url, {
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
