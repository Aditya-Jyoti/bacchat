/**
 * App services: database, NAV client, clock, secure store, settings, and the lazily built
 * advisor and sync handles. createServices() is the real (async) entry point; createTestServices()
 * is a synchronous in-memory variant for tests.
 */
import { createMemoryDb, openBacchatDb, seedIfEmpty, SAMPLE_TODAY, SEED_FLAG, dateKey, type BacchatDb, type OpenOptions } from '../data/db';
import { createAdvisor, type Advisor } from '../lib/ai';
import { usePreferences } from '../lib/preferences';
import { createNavClient, refreshHoldingNavs, type NavClient, type NavFetch, type RefreshResult } from '../lib/nav';
import { BlobCipher, SyncClient, SyncEngine, runSyncWithStatus } from '../lib/sync';
import type { FetchLike } from '../lib/sync/client';
import type { SodiumLike } from '../lib/sync/crypto';
import type { NetworkProbe, SyncResult } from '../lib/sync/engine';
import { observeDb, type ObservableDb } from './observable';
import { createExpoSecureStore, createMemorySecureStore, randomHex, SECURE_KEYS, type SecureStore } from './secure';
import { createSettings, type AppSettings, type SyncConfig } from './settings';
import { createLocalDataSource, createSyncStateStore } from './syncData';
import { loadSodium } from './sodium';

export const SAMPLE_EXITED_FLAG = 'sample.exited.v1';

export type SyncHandle = {
  client: SyncClient;
  engine: SyncEngine;
  cipher: BlobCipher;
  config: SyncConfig;
  /** Runs one sync and mirrors progress into useSyncStatus. Null if it threw (status store holds the message). */
  run(): Promise<SyncResult | null>;
};

export type Services = {
  db: ObservableDb;
  navClient: NavClient;
  secure: SecureStore;
  settings: AppSettings;
  /** Current time in ms: SAMPLE_TODAY while the seeded sample is in use, otherwise Date.now(). */
  now(): number;
  /** True while now() is pinned to the design's sample day. */
  isSample(): boolean;
  /** Switch to the real clock (for example after the user clears the sample data). */
  exitSampleMode(): Promise<void>;
  /** 'sqlite' when the on-device database opened, 'memory' when it fell back. */
  dbKind: 'memory' | 'sqlite';
  /** Why the database fell back to memory, if it did. */
  dbError: string | null;
  /** Resolves when the database is ready to query (immediate for real services). */
  whenReady(): Promise<void>;
  /** Once-a-day NAV refresh. Resolves null when already done today (unless force). Never throws. */
  refreshNavs(opts?: { force?: boolean }): Promise<RefreshResult | null>;
  /** Advisor on the stored key and model, or null when no key is saved. */
  createAdvisor(): Promise<Advisor | null>;
  /** Sync client and engine, or null when sync is off or not set up. Cached until settings change. */
  getSync(): Promise<SyncHandle | null>;
};

export type ServicesOptions = {
  secure?: SecureStore;
  /** Use this database instead of opening one (tests). It is wrapped, and seeded unless seed is false. */
  db?: BacchatDb;
  /** Seed the design's sample data into an empty db. Default true. */
  seed?: boolean;
  /** Fixed clock. Overrides the sample-day logic. */
  now?: () => number;
  fetch?: typeof fetch;
  navFetch?: NavFetch;
  syncFetch?: FetchLike;
  sodium?: () => Promise<SodiumLike>;
  probe?: NetworkProbe;
  /** Name of the SQLite file. */
  dbName?: string;
  /** Override how the SQLite file is opened (tests). */
  open?: OpenOptions['open'];
};

function dbKeyProvider(secure: SecureStore, random: () => string) {
  return {
    async getKey(): Promise<string | null> {
      const have = await secure.get(SECURE_KEYS.dbKey);
      if (have) return have;
      const key = random();
      await secure.set(SECURE_KEYS.dbKey, key);
      return key;
    },
  };
}

type BuildState = { dbError: string | null; sample: boolean; ready: () => Promise<void> };

function build(raw: BacchatDb, opts: ServicesOptions, state: BuildState): Services {
  const secure = opts.secure ?? createExpoSecureStore();
  const settings = createSettings(secure);
  const db = observeDb(raw);
  const fetchImpl = (opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a))) as typeof fetch;
  const navFetch = (opts.navFetch ?? ((url, init) => fetchImpl(url, init as RequestInit))) as NavFetch;
  const navClient = createNavClient({ fetch: navFetch });
  const realNow = (): number => (opts.now ? opts.now() : Date.now());

  let advisorKey = '';
  let advisor: Advisor | null = null;
  let syncKey = '';
  let sync: SyncHandle | null = null;
  settings.subscribe(() => {
    advisorKey = '';
    syncKey = '';
  });

  const services: Services = {
    db,
    navClient,
    secure,
    settings,
    dbKind: raw.kind,
    dbError: state.dbError,
    now: () => (opts.now ? opts.now() : state.sample ? SAMPLE_TODAY : Date.now()),
    isSample: () => state.sample && !opts.now,
    async exitSampleMode() {
      state.sample = false;
      await raw.meta.set(SAMPLE_EXITED_FLAG, '1');
      db.notify();
    },
    whenReady: () => state.ready(),

    async refreshNavs(o = {}) {
      try {
        const today = dateKey(realNow());
        if (!o.force && usePreferences.getState().lastNavRefreshDay === today) return null;
        const result = await refreshHoldingNavs(db, navClient, o.force ?? false);
        if (!result.error) usePreferences.getState().setLastNavRefreshDay(today);
        return result;
      } catch {
        return null;
      }
    },

    async createAdvisor() {
      const apiKey = await settings.getApiKey();
      if (!apiKey) return null;
      const model = await settings.getModel();
      const k = `${apiKey}|${model}`;
      if (advisor && k === advisorKey) return advisor;
      advisor = createAdvisor({
        apiKey,
        model,
        db,
        now: services.now,
        fetch: ((url, init) => fetchImpl(url, init)) as Parameters<typeof createAdvisor>[0]['fetch'],
      });
      advisorKey = k;
      return advisor;
    },

    async getSync() {
      if (!settings.isSyncEnabled()) return null;
      const config = await settings.getSyncConfig();
      if (!config) return null;
      const k = `${config.baseUrl}|${config.token}|${config.deviceId}|${Array.from(config.masterKey).join(',')}`;
      if (sync && k === syncKey) return sync;
      const sodium = await (opts.sodium ?? loadSodium)();
      const client = new SyncClient({ baseUrl: config.baseUrl, token: config.token, fetch: opts.syncFetch });
      const cipher = new BlobCipher(sodium, config.masterKey);
      const engine = new SyncEngine({
        client,
        cipher,
        data: createLocalDataSource(db),
        state: createSyncStateStore(),
        options: () => settings.getSyncOptions(),
        probe: opts.probe,
      });
      sync = { client, engine, cipher, config, run: () => runSyncWithStatus(engine, client) };
      syncKey = k;
      return sync;
    },
  };
  return services;
}

/** Opens the real database (SQLCipher key from the secure store), seeds it and builds the services. */
export async function createServices(opts: ServicesOptions = {}): Promise<Services> {
  const secure = opts.secure ?? createExpoSecureStore();
  let raw: BacchatDb;
  let dbError: string | null = null;
  if (opts.db) {
    raw = opts.db;
  } else {
    try {
      raw = await openBacchatDb({ name: opts.dbName, open: opts.open, keyProvider: dbKeyProvider(secure, () => randomHex(32)) });
    } catch (e) {
      dbError = e instanceof Error ? e.message : 'Could not open the database.';
      raw = createMemoryDb();
    }
  }
  let sample = false;
  if (opts.seed !== false) {
    try {
      await seedIfEmpty(raw);
      sample = (await raw.meta.get(SEED_FLAG)) === '1' && (await raw.meta.get(SAMPLE_EXITED_FLAG)) !== '1';
    } catch (e) {
      dbError ??= e instanceof Error ? e.message : 'Could not prepare the database.';
    }
  }
  return build(raw, { ...opts, secure }, { dbError, sample, ready: () => Promise.resolve() });
}

/**
 * Synchronous services over an in-memory database for tests. Seeding is lazy: it starts the first
 * time whenReady() is called (the query hooks do that), so tests that never query pay nothing.
 */
export function createTestServices(opts: ServicesOptions = {}): Services {
  const raw = opts.db ?? createMemoryDb();
  const seed = opts.seed !== false;
  let seeding: Promise<void> | undefined;
  // Until seeding finishes we assume the sample will be used, so now() is stable from the first render.
  const state: BuildState = {
    dbError: null,
    sample: seed,
    ready: () => {
      seeding ??= (async () => {
        if (!seed) return;
        await seedIfEmpty(raw);
        state.sample = (await raw.meta.get(SEED_FLAG)) === '1' && (await raw.meta.get(SAMPLE_EXITED_FLAG)) !== '1';
        services.db.notify();
      })();
      return seeding;
    },
  };
  const services = build(raw, { ...opts, secure: opts.secure ?? createMemorySecureStore() }, state);
  return services;
}
