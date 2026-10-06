import { DEFAULT_NPS_URL, createNavClient, expandNavUrl, isValidNavUrl } from '../client';
import { usePreferences } from '../../preferences';
import { setAppExtraForTests, getNpsNavUrlDefault } from '../../appConfig';
import type { NavFetch } from '../types';
import { NPS_CSV } from './fixtures';

const okFetch = (): jest.MockedFunction<NavFetch> =>
  jest.fn(async () => ({ ok: true, status: 200, text: async () => NPS_CSV })) as unknown as jest.MockedFunction<NavFetch>;

describe('NPS NAV source setting', () => {
  it('uses the documented default when nothing is set', async () => {
    const f = okFetch();
    await createNavClient({ fetch: f }).getNps();
    expect(f.mock.calls[0][0]).toBe(DEFAULT_NPS_URL);
    await createNavClient({ fetch: okFetch(), npsUrl: () => '' }).getNps();
  });

  it('uses a configured URL, read again on every request, with its own cache entry', async () => {
    let url = 'https://nav.example.org/a.csv';
    const f = okFetch();
    const c = createNavClient({ fetch: f, npsUrl: () => url });
    await c.getNps();
    await c.getNps();
    expect(f).toHaveBeenCalledTimes(1); // second call from cache
    url = 'https://nav.example.org/b.csv';
    const r = await c.getNps();
    expect(r.fromCache).toBe(false);
    expect(f.mock.calls.map((x) => x[0])).toEqual(['https://nav.example.org/a.csv', 'https://nav.example.org/b.csv']);
  });

  it('ignores a value that is not a web address', async () => {
    const f = okFetch();
    await createNavClient({ fetch: f, npsUrl: 'not a url' }).getNps();
    expect(f.mock.calls[0][0]).toBe(DEFAULT_NPS_URL);
    expect(isValidNavUrl('https://x.org/a')).toBe(true);
    expect(isValidNavUrl('ftp://x.org')).toBe(false);
  });

  it('fills date tokens for sources that publish one file a day', () => {
    const at = new Date(2026, 9, 5, 12).getTime();
    expect(expandNavUrl('https://x.org/NAV_File_{DDMMYYYY}.out', at)).toBe('https://x.org/NAV_File_05102026.out');
    expect(expandNavUrl('https://x.org/{YYYY}/{MM}/{DD}.csv', at)).toBe('https://x.org/2026/10/05.csv');
  });

  it('has a preference field and a build-wide default, independent of any settings screen', () => {
    expect(usePreferences.getState().npsNavUrl).toBe('');
    usePreferences.getState().setNpsNavUrl('  https://nav.example.org/x.csv ');
    expect(usePreferences.getState().npsNavUrl).toBe('https://nav.example.org/x.csv');
    usePreferences.getState().setNpsNavUrl('');
    expect(getNpsNavUrlDefault()).toBe('');
    setAppExtraForTests({ npsNavUrl: 'https://build.example/nps.csv' });
    expect(getNpsNavUrlDefault()).toBe('https://build.example/nps.csv');
    setAppExtraForTests(null);
  });
});
