import { holdingValuePaise, parseNavMicro } from '../valuation';
import { parseAmfiDate, parseAmfiNav } from '../amfi';
import { parseNpsCsv, parseNpsHtml, parseNpsNav, parseNpsDate, splitCsvLine } from '../nps';
import { createMemoryNavCache, createNavClient } from '../client';
import { refreshHoldingNavs, valueHoldings } from '../holdings';
import { NavError, type NavFetch } from '../types';
import { createMemoryDb } from '../../../data/db/memory';
import { AMFI_MIN, AMFI_SAMPLE, NPS_CSV, NPS_CSV_NO_DATE, NPS_HTML } from './fixtures';

describe('valuation', () => {
  it.each([
    [1_000_000_000, 62_500_000, 6250000], // 1000 units x 62.5 = 62,500.00 rupees
    [4_000_000_000, 62_500_000, 25000000],
    [123_456_000, 52_345_600, 646_238], // rounds to nearest paise
    [1, 1, 0],
    [0, 99_000_000, 0],
  ])('units %p x nav %p = %p paise', (u, n, expected) => {
    expect(holdingValuePaise(u, n)).toBe(expected);
  });

  it('rounds half up and stays exact for huge values', () => {
    // 0.005 rupees = half a paise -> 1 paise
    expect(holdingValuePaise(1_000_000, 5000)).toBe(1);
    expect(holdingValuePaise(1_000_000, 4999)).toBe(0);
    // 10 crore units at NAV 1000 -> beyond 2^53 in the intermediate product
    expect(holdingValuePaise(100_000_000 * 1_000_000, 1_000_000_000)).toBe(100_000_000 * 1000 * 100);
  });

  it('rejects non-integers', () => {
    expect(() => holdingValuePaise(1.5, 1)).toThrow();
  });

  it.each([
    ['52.3456', 52_345_600],
    ['1,010.5', 1_010_500_000],
    ['0.0000001', null],
    ['N.A.', null],
    ['', null],
    ['-5', null],
    ['10', 10_000_000],
    [' 9.1234567 ', 9_123_456],
  ])('parseNavMicro(%p) = %p', (s, expected) => {
    expect(parseNavMicro(s)).toBe(expected);
  });
});

describe('AMFI NAVAll.txt parser', () => {
  const t = parseAmfiNav(AMFI_SAMPLE);

  it('parses scheme rows with code, ISINs, name, NAV and date', () => {
    expect(t.source).toBe('amfi');
    const r = t.byCode.get('120465')!;
    expect(r).toMatchObject({
      schemeCode: '120465',
      isinPayout: 'INF846K01DP8',
      isinReinvest: null,
      name: 'Axis Bluechip Fund - Direct Plan - Growth',
      navMicro: 62_500_000,
      date: '2026-10-23',
    });
    expect(t.byCode.get('120466')).toMatchObject({ isinPayout: 'INF846K01DQ6', isinReinvest: 'INF846K01DR4' });
  });

  it('tracks category and fund house headings', () => {
    expect(t.byCode.get('120465')).toMatchObject({ category: 'Equity Scheme - Large Cap Fund', amc: 'Axis Mutual Fund' });
    expect(t.byCode.get('122639')).toMatchObject({ category: 'Equity Scheme - Flexi Cap Fund', amc: 'PPFAS Mutual Fund' });
    expect(t.byCode.get('118989')?.amc).toBe('HDFC Mutual Fund');
  });

  it('skips header, blanks, N.A. NAVs, bad dates, non-numeric codes and short lines', () => {
    expect(t.byCode.has('119551')).toBe(false);
    expect(t.byCode.has('100001')).toBe(false);
    expect(t.byCode.has('100002')).toBe(false);
    expect(t.byCode.has('abc')).toBe(false);
    expect(t.records.map((r) => r.schemeCode)).toEqual(['120465', '120466', '122639', '118989', '140001']);
  });

  it('copes with semicolons in the name and thousands separators in NAV', () => {
    expect(t.byCode.get('140001')).toMatchObject({ name: 'Fixed Term Plan; Series 5 (1,200 days)', navMicro: 1_010_500_000 });
  });

  it('handles CRLF line endings and empty input', () => {
    expect(parseAmfiNav(AMFI_MIN).records).toHaveLength(1);
    expect(parseAmfiNav('').records).toEqual([]);
    expect(parseAmfiNav('garbage\nmore garbage').records).toEqual([]);
  });

  it.each([
    ['23-Oct-2026', '2026-10-23'],
    ['1-Jan-2027', '2027-01-01'],
    ['01-DEC-2026', '2026-12-01'],
    ['23/10/2026', null],
    ['32-Oct-2026', null],
    ['23-Xyz-2026', null],
  ])('parseAmfiDate(%p) = %p', (s, expected) => {
    expect(parseAmfiDate(s)).toBe(expected);
  });
});

describe('NPS parsers', () => {
  it('splits quoted CSV fields', () => {
    expect(splitCsvLine('a,"b,c","d ""e"""')).toEqual(['a', 'b,c', 'd "e"']);
  });

  it('parses CSV with a header, quotes and several date formats', () => {
    const t = parseNpsCsv(NPS_CSV);
    expect(t.source).toBe('nps');
    expect(t.records.map((r) => r.schemeCode)).toEqual(['SM001003', 'SM001004', 'SM003001']);
    expect(t.byCode.get('SM001003')).toMatchObject({ name: 'SBI PENSION FUND SCHEME C - TIER I', navMicro: 31_280_000, date: '2026-10-23' });
    expect(t.byCode.get('SM003001')).toMatchObject({ name: 'LIC PENSION FUND SCHEME "G" - TIER I', date: '2026-10-23' });
  });

  it('uses the fallback date when the file has no date column', () => {
    expect(parseNpsCsv(NPS_CSV_NO_DATE).records).toEqual([]); // no date anywhere: skip rather than guess
    const t = parseNpsCsv(NPS_CSV_NO_DATE, '2026-10-23');
    expect(t.records).toHaveLength(2);
    expect(t.byCode.get('SM001004')?.date).toBe('2026-10-23');
  });

  it('parses an HTML table, decoding entities and tags', () => {
    const t = parseNpsHtml(NPS_HTML);
    expect(t.records.map((r) => r.schemeCode)).toEqual(['SM001003', 'SM001004']);
    expect(t.byCode.get('SM001003')?.name).toBe('SBI Pension Fund & Scheme C - Tier I');
    expect(t.byCode.get('SM001004')?.name).toBe('SBI Pension Fund Scheme E - Tier I');
  });

  it('auto-detects html or csv, and returns empty for unknown content', () => {
    expect(parseNpsNav(NPS_HTML).records).toHaveLength(2);
    expect(parseNpsNav(NPS_CSV).records).toHaveLength(3);
    expect(parseNpsNav('nothing useful here').records).toEqual([]);
    expect(parseNpsNav('<table><tr><td>x</td></tr></table>').records).toEqual([]);
  });

  it.each([
    ['2026-10-23', '2026-10-23'],
    ['23-10-2026', '2026-10-23'],
    ['3/1/2026', '2026-01-03'],
    ['23-Oct-2026', '2026-10-23'],
    ['soon', null],
  ])('parseNpsDate(%p) = %p', (s, expected) => {
    expect(parseNpsDate(s)).toBe(expected);
  });
});

function okFetch(body: string): jest.MockedFunction<NavFetch> {
  const f: NavFetch = async () => ({ ok: true, status: 200, text: async () => body });
  return jest.fn(f);
}

describe('NAV client', () => {
  it('fetches anonymously: plain GET, no cookies, auth, body or identifiers', async () => {
    const f = okFetch(AMFI_SAMPLE);
    const c = createNavClient({ fetch: f });
    await c.getAmfi();
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://www.amfiindia.com/spages/NAVAll.txt');
    expect(init?.method).toBe('GET');
    expect(init?.credentials).toBe('omit');
    expect(Object.keys(init?.headers ?? {}).map((k) => k.toLowerCase())).toEqual(['accept']);
    expect(init).not.toHaveProperty('body');
    expect(JSON.stringify(f.mock.calls)).not.toMatch(/cookie|authorization|bearer|device|user/i);
  });

  it('caches within the TTL and refetches after it', async () => {
    let now = 1_000;
    const f = okFetch(AMFI_SAMPLE);
    const c = createNavClient({ fetch: f, now: () => now, ttlMs: 10_000 });
    const a = await c.getAmfi();
    expect(a).toMatchObject({ fromCache: false, stale: false, fetchedAt: 1_000 });
    now = 5_000;
    const b = await c.getAmfi();
    expect(b).toMatchObject({ fromCache: true, stale: false });
    expect(b.table).toBe(a.table); // parsed once
    expect(f).toHaveBeenCalledTimes(1);
    now = 11_001;
    const d = await c.getAmfi();
    expect(d.fromCache).toBe(false);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('force bypasses a fresh cache', async () => {
    const f = okFetch(AMFI_SAMPLE);
    const c = createNavClient({ fetch: f });
    await c.getAmfi();
    await c.getAmfi(true);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('serves a stale copy when the network fails after the TTL', async () => {
    let now = 0;
    const good = okFetch(AMFI_SAMPLE);
    const cache = createMemoryNavCache();
    await createNavClient({ fetch: good, cache, now: () => now, ttlMs: 100 }).getAmfi();
    now = 1_000;
    const bad: NavFetch = async () => {
      throw new Error('Network request failed');
    };
    const r = await createNavClient({ fetch: bad, cache, now: () => now, ttlMs: 100 }).getAmfi();
    expect(r).toMatchObject({ stale: true, fromCache: true, fetchedAt: 0 });
    expect(r.table.records.length).toBeGreaterThan(0);
  });

  it('maps failures with no cache to offline, http and parse errors', async () => {
    const offline = createNavClient({ fetch: async () => { throw new Error('boom'); } });
    await expect(offline.getAmfi()).rejects.toMatchObject({ code: 'offline' });
    const http = createNavClient({ fetch: async () => ({ ok: false, status: 503, text: async () => '' }) });
    await expect(http.getAmfi()).rejects.toMatchObject({ code: 'http', status: 503 });
    const junk = createNavClient({ fetch: okFetch('<html>maintenance</html>') });
    await expect(junk.getAmfi()).rejects.toBeInstanceOf(NavError);
    await expect(junk.getAmfi()).rejects.toMatchObject({ code: 'parse' });
  });

  it('does not cache a bad response over a good one', async () => {
    let now = 0;
    const cache = createMemoryNavCache();
    await createNavClient({ fetch: okFetch(AMFI_SAMPLE), cache, now: () => now, ttlMs: 10 }).getAmfi();
    now = 100;
    const r = await createNavClient({ fetch: okFetch('oops'), cache, now: () => now, ttlMs: 10 }).getAmfi();
    expect(r.stale).toBe(true);
    expect((await cache.get('nav.amfi'))?.fetchedAt).toBe(0);
  });

  it('fetches NPS from its own url', async () => {
    const f = okFetch(NPS_CSV);
    const c = createNavClient({ fetch: f, npsUrl: 'https://example.test/nps.csv' });
    const r = await c.getNps();
    expect(f.mock.calls[0][0]).toBe('https://example.test/nps.csv');
    expect(r.table.source).toBe('nps');
  });
});

describe('holdings valuation', () => {
  const base = { updatedAt: 0, accountId: 'acc' };
  const holdings = [
    { ...base, id: 'h1', kind: 'mf' as const, schemeCode: '120465', name: 'Axis', unitsMicro: 4_000_000_000, lastNavMicro: 60_000_000, lastNavDate: '2026-10-01' },
    { ...base, id: 'h2', kind: 'mf' as const, schemeCode: '999999', name: 'Unknown', unitsMicro: 1_000_000_000, lastNavMicro: 10_000_000 },
    { ...base, id: 'h3', kind: 'nps' as const, schemeCode: 'SM001003', name: 'SBI C', unitsMicro: 10_000_000_000, lastNavMicro: null },
    { ...base, id: 'h4', kind: 'mf' as const, schemeCode: '555555', name: 'Never priced', unitsMicro: 1, lastNavMicro: null },
  ];

  it('values from the table, falls back to stored NAV, reports missing', () => {
    const v = valueHoldings(holdings, [parseAmfiNav(AMFI_SAMPLE), parseNpsCsv(NPS_CSV)]);
    expect(v.holdings[0]).toMatchObject({ valuePaise: 25_000_000, navMicro: 62_500_000, usedStored: false, navDate: '2026-10-23' });
    expect(v.holdings[1]).toMatchObject({ valuePaise: 1_000_000, usedStored: true });
    expect(v.holdings[2].valuePaise).toBe(31_280_000);
    expect(v.holdings[3]).toMatchObject({ valuePaise: null });
    expect(v.missing).toEqual(['555555']);
    expect(v.totalPaise).toBe(25_000_000 + 1_000_000 + 31_280_000);
  });

  it('refreshes holdings in the database and values them', async () => {
    const db = createMemoryDb();
    await db.holdings.putMany(holdings.slice(0, 3));
    const f: NavFetch = async (url) => ({ ok: true, status: 200, text: async () => (url.includes('amfi') ? AMFI_SAMPLE : NPS_CSV) });
    const client = createNavClient({ fetch: f, npsUrl: 'https://example.test/nps' });
    const r = await refreshHoldingNavs(db, client);
    expect(r).toMatchObject({ updated: 2, stale: false, error: null });
    expect((await db.holdings.get('h1'))?.lastNavMicro).toBe(62_500_000);
    expect((await db.holdings.get('h1'))?.lastNavDate).toBe('2026-10-23');
    expect((await db.holdings.get('h3'))?.lastNavMicro).toBe(31_280_000);
    expect((await db.holdings.get('h2'))?.lastNavMicro).toBe(10_000_000);
    const again = await refreshHoldingNavs(db, client);
    expect(again.updated).toBe(0);
  });

  it('only fetches the sources that are needed', async () => {
    const db = createMemoryDb();
    await db.holdings.put(holdings[0]);
    const f = okFetch(AMFI_SAMPLE);
    await refreshHoldingNavs(db, createNavClient({ fetch: f }));
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('keeps stored values and reports a calm error when offline', async () => {
    const db = createMemoryDb();
    await db.holdings.putMany(holdings.slice(0, 2));
    const client = createNavClient({ fetch: async () => { throw new Error('offline'); } });
    const r = await refreshHoldingNavs(db, client);
    expect(r.error).toBe('offline');
    expect(r.stale).toBe(true);
    expect(r.updated).toBe(0);
    expect(r.holdings[0].valuePaise).toBe(24_000_000);
  });
});
