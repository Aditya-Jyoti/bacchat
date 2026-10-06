/** @jest-environment node */
import { SAMPLE_TODAY, createMemoryDb, seedIfEmpty } from '../../data/db';
import { createMemoryStorage, setStorage } from '../../lib/storage';
import { usePreferences } from '../../lib/preferences';
import { AMFI_SAMPLE, NPS_CSV } from '../../lib/nav/__tests__/fixtures';
import { createMemorySecureStore, observeDb, createServices, createTestServices, createSettings, SECURE_KEYS, DEFAULT_ADVISOR_MODEL, randomHex } from '..';

beforeEach(() => {
  setStorage(createMemoryStorage());
  usePreferences.setState({ lastNavRefreshDay: null, syncEnabled: false });
});

describe('secure store and settings', () => {
  it('stores, reads and removes secrets', async () => {
    const s = createMemorySecureStore();
    await s.set('a', '1');
    expect(await s.get('a')).toBe('1');
    await s.remove('a');
    expect(await s.get('a')).toBeNull();
  });

  it('keeps the api key and model in the secure store with a default model', async () => {
    const secure = createMemorySecureStore();
    const st = createSettings(secure);
    expect(await st.getApiKey()).toBeNull();
    expect(await st.getModel()).toBe(DEFAULT_ADVISOR_MODEL);
    await st.setApiKey('  sk-test  ');
    await st.setModel('claude-x');
    expect(await st.getApiKey()).toBe('sk-test');
    expect(await st.getModel()).toBe('claude-x');
    expect(secure.dump()[SECURE_KEYS.apiKey]).toBe('sk-test');
    await st.setApiKey('');
    expect(await st.getApiKey()).toBeNull();
  });

  it('round-trips the sync config and flips the sync flag', async () => {
    const st = createSettings(createMemorySecureStore());
    const seen: number[] = [];
    st.subscribe(() => seen.push(1));
    expect(await st.getSyncConfig()).toBeNull();
    const key = new Uint8Array(32).map((_, i) => i);
    await st.setSyncConfig({ baseUrl: 'https://x.test', token: 't', deviceId: 'd', masterKey: key });
    expect(st.isSyncEnabled()).toBe(true);
    const back = await st.getSyncConfig();
    expect(back?.baseUrl).toBe('https://x.test');
    expect(Array.from(back!.masterKey)).toEqual(Array.from(key));
    st.setSyncEnabled(false);
    expect(st.isSyncEnabled()).toBe(false);
    st.setSyncOptions({ shots: true });
    expect(st.getSyncOptions().shots).toBe(true);
    expect(st.getSyncOptions().entries).toBe(true);
    await st.setSyncConfig(null);
    expect(await st.getSyncConfig()).toBeNull();
    expect(seen.length).toBeGreaterThanOrEqual(3);
  });

  it('makes 64 hex characters of randomness', () => {
    expect(randomHex(32)).toMatch(/^[0-9a-f]{64}$/);
    expect(randomHex(32)).not.toBe(randomHex(32));
  });
});

describe('observeDb', () => {
  it('emits once per write and bumps the version, not for reads', async () => {
    const db = observeDb(createMemoryDb());
    let n = 0;
    const off = db.onChange(() => {
      n += 1;
    });
    await db.categories.list();
    expect(n).toBe(0);
    await db.categories.put({ id: 'c1', name: 'Tea', icon: 'coffee' });
    await db.categories.putMany([{ id: 'c2', name: 'Fuel', icon: 'local_gas_station' }]);
    await db.categories.remove('c1');
    expect(n).toBe(3);
    expect(db.version()).toBe(3);
    expect((await db.categories.list()).map((c) => c.id)).toEqual(['c2']);
    off();
    await db.categories.put({ id: 'c3', name: 'x', icon: 'x' });
    expect(n).toBe(3);
  });

  it('wraps entry-specific writes and keeps method behaviour', async () => {
    const raw = createMemoryDb();
    await seedIfEmpty(raw);
    const db = observeDb(raw);
    let n = 0;
    db.onChange(() => {
      n += 1;
    });
    const [e] = await db.entries.toReview();
    const confirmed = await db.entries.confirm(e.id);
    expect(confirmed?.status).toBe('confirmed');
    expect(n).toBe(1);
    expect((await db.entries.toReview()).find((x) => x.id === e.id)).toBeUndefined();
  });
});

describe('createServices', () => {
  it('seeds an empty db and uses the sample day', async () => {
    const s = await createServices({ db: createMemoryDb(), secure: createMemorySecureStore() });
    expect(s.dbKind).toBe('memory');
    expect(s.isSample()).toBe(true);
    expect(s.now()).toBe(SAMPLE_TODAY);
    expect((await s.db.accounts.list()).length).toBeGreaterThan(0);
  });

  it('uses the real clock when not seeded with sample data, or after exitSampleMode', async () => {
    const empty = await createServices({ db: createMemoryDb(), seed: false, secure: createMemorySecureStore() });
    expect(empty.isSample()).toBe(false);
    expect(Math.abs(empty.now() - Date.now())).toBeLessThan(5000);
    const s = await createServices({ db: createMemoryDb(), secure: createMemorySecureStore() });
    let changes = 0;
    s.db.onChange(() => {
      changes += 1;
    });
    await s.exitSampleMode();
    expect(s.isSample()).toBe(false);
    expect(changes).toBe(1);
    expect(Math.abs(s.now() - Date.now())).toBeLessThan(5000);
  });

  it('does not reseed a db that was already seeded and exited', async () => {
    const raw = createMemoryDb();
    const a = await createServices({ db: raw, secure: createMemorySecureStore() });
    await a.exitSampleMode();
    const b = await createServices({ db: raw, secure: createMemorySecureStore() });
    expect(b.isSample()).toBe(false);
  });

  it('falls back to a memory db when opening fails, after creating a db key', async () => {
    const secure = createMemorySecureStore();
    const s = await createServices({
      secure,
      open: async () => {
        throw new Error('cannot open');
      },
    });
    expect(s.dbKind).toBe('memory');
    expect(s.dbError).toBe('cannot open');
    expect(s.isSample()).toBe(true);
    // The key provider only runs after the file opens, so nothing is stored yet.
    expect(secure.dump()[SECURE_KEYS.dbKey]).toBeUndefined();
  });

  it('generates and persists a db key on first open and reuses it', async () => {
    const secure = createMemorySecureStore();
    const pragmas: string[] = [];
    const open = async () => ({
      execAsync: async (sql: string) => {
        pragmas.push(sql);
        throw new Error('stop here');
      },
      runAsync: async () => undefined,
      getAllAsync: async () => [],
      closeAsync: async () => undefined,
    });
    await createServices({ secure, open: open as never });
    const key = secure.dump()[SECURE_KEYS.dbKey];
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(pragmas[0]).toContain(key);
    await createServices({ secure, open: open as never });
    expect(secure.dump()[SECURE_KEYS.dbKey]).toBe(key);
  });
});

describe('createTestServices', () => {
  it('seeds lazily on whenReady and notifies', async () => {
    const s = createTestServices();
    expect(await s.db.accounts.list()).toHaveLength(0);
    let n = 0;
    s.db.onChange(() => {
      n += 1;
    });
    await s.whenReady();
    expect((await s.db.accounts.list()).length).toBeGreaterThan(0);
    expect(n).toBeGreaterThan(0);
    expect(s.now()).toBe(SAMPLE_TODAY);
  });

  it('honours seed:false, a custom db and a fixed clock', async () => {
    const db = createMemoryDb();
    const s = createTestServices({ db, seed: false, now: () => 42 });
    await s.whenReady();
    expect(await db.accounts.list()).toHaveLength(0);
    expect(s.now()).toBe(42);
    expect(s.isSample()).toBe(false);
  });
});

describe('refreshNavs', () => {
  const navFetch = (calls: string[]) => async (url: string) => {
    calls.push(url);
    return { ok: true, status: 200, text: async () => (url.includes('amfi') ? AMFI_SAMPLE : NPS_CSV) };
  };

  it('refreshes once a day and writes NAVs onto holdings', async () => {
    const calls: string[] = [];
    const s = createTestServices({ navFetch: navFetch(calls), now: () => new Date(2026, 9, 24, 12).getTime() });
    await s.whenReady();
    const first = await s.refreshNavs();
    expect(first).not.toBeNull();
    expect(calls.some((u) => u.includes('amfi'))).toBe(true);
    expect(usePreferences.getState().lastNavRefreshDay).toBe('2026-10-24');
    const before = calls.length;
    expect(await s.refreshNavs()).toBeNull();
    expect(calls.length).toBe(before);
    expect(await s.refreshNavs({ force: true })).not.toBeNull();
  });

  it('never throws and does not mark the day on a network error', async () => {
    const s = createTestServices({
      navFetch: async () => {
        throw new Error('offline');
      },
      now: () => new Date(2026, 9, 24, 12).getTime(),
    });
    await s.whenReady();
    const r = await s.refreshNavs();
    expect(r?.error).toBeTruthy();
    expect(usePreferences.getState().lastNavRefreshDay).toBeNull();
  });
});

describe('createAdvisor factory', () => {
  it('is null without a key, then built from the stored key and model', async () => {
    const s = createTestServices();
    expect(await s.createAdvisor()).toBeNull();
    await s.settings.setApiKey('sk-abc');
    await s.settings.setModel('claude-test');
    const a = await s.createAdvisor();
    expect(a).not.toBeNull();
    expect(typeof a!.ask).toBe('function');
    expect(await s.createAdvisor()).toBe(a);
    await s.settings.setModel('claude-other');
    expect(await s.createAdvisor()).not.toBe(a);
    await s.settings.setApiKey(null);
    expect(await s.createAdvisor()).toBeNull();
  });

  it('sends the stored key and model to the injected fetch', async () => {
    const seen: { url: string; headers: Record<string, string>; body: string }[] = [];
    const fake = async (url: string, init: { headers: Record<string, string>; body: string }) => {
      seen.push({ url, headers: init.headers, body: init.body });
      const body = { content: [{ type: 'text', text: 'Hello' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } };
      return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
    };
    const s = createTestServices({ fetch: fake as never });
    await s.settings.setApiKey('sk-abc');
    await s.settings.setModel('claude-test');
    await s.whenReady();
    const a = (await s.createAdvisor())!;
    const events: unknown[] = [];
    for await (const ev of a.ask('How am I doing?')) events.push(ev);
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toContain('/v1/messages');
    expect(Object.values(seen[0].headers)).toContain('sk-abc');
    expect(JSON.parse(seen[0].body).model).toBe('claude-test');
  });
});
