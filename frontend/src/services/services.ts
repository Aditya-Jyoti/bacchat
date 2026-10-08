/**
 * App services: database, NAV client, clock, secure store, settings, and the lazily built
 * advisor and sync handles. createServices() is the real (async) entry point; createTestServices()
 * is a synchronous in-memory variant for tests.
 */
import { ensureOpeningBalances } from '../data/db/queries/balances';
import { createMemoryDb, openBacchatDb, seedFromSampleData, seedIfEmpty, seedStandardCategories, SAMPLE_EXITED_FLAG, SAMPLE_TODAY, SEED_FLAG, dateKey, type BacchatDb, type OpenOptions } from '../data/db';
import { createAdvisor, type Advisor } from '../lib/ai';
import { createAiService, type AiService, type AiServiceOptions } from './aiService';
import { usePreferences } from '../lib/preferences';
import { useGoalPlans } from '../screens/goals/goalPlanStore';
import { useBudget } from '../screens/you/budgetStore';
import { useBudgetAlerts } from '../screens/home/alertsStore';
import { createNavClient, refreshHoldingNavs, type NavClient, type NavFetch, type RefreshResult } from '../lib/nav';
import { BlobCipher, SyncEngine, createTarget, runSyncWithStatus, useSyncStatus } from '../lib/sync';
import type { AccessTokenProvider } from '../lib/sync/targets';
import type { SyncTarget } from '../lib/sync/target';
import type { FetchLike } from '../lib/sync/client';
import { createGoogleTokenProvider, type GoogleTokenProvider } from './googleAuth';
import { getGoogleClientId, getNpsNavUrlDefault } from '../lib/appConfig';
import type { SodiumLike } from '../lib/sync/crypto';
import type { NetworkProbe, SyncResult } from '../lib/sync/engine';
import { observeDb, type ObservableDb } from './observable';
import { createDbKeyProvider } from './dbKey';
import { createExpoSecureStore, createMemorySecureStore, type SecureStore } from './secure';
import { createSettings, type AppSettings, type SyncConfig } from './settings';
import { createLocalDataSource, createSyncStateStore, resetSyncBookkeeping } from './syncData';
import { loadSodium } from './sodium';
import { expoShotFiles, syncShotImages, type ShotFiles } from './shotImages';

export { SAMPLE_EXITED_FLAG };

export type SyncHandle = {
  client: SyncTarget;
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
  /**
   * Delete everything the person has written: all tables and meta in the database, the stores that
   * hold user data (goal plans, budget, pending alerts), then leave sample mode. Keeps only the
   * standard category set. Does not touch the database key, first-run state or preferences (apart from
   * the NAV refresh day), and never touches copies already backed up in the cloud.
   */
  clearAllData(): Promise<void>;
  /**
   * Fill an empty notebook with the design's sample data and turn sample mode on. Returns false
   * (and changes nothing) when the notebook already has accounts, entries or goals.
   */
  seedSample(): Promise<boolean>;
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
  /** AI router and features: advisor engine, message extraction, category suggestions, on-device models, consent. */
  ai: AiService;
  /** Google Drive sign-in (tokens kept in the secure store). Drive sync uses it; K25 calls signIn(). */
  google: GoogleTokenProvider;
  /** Sync client and engine, or null when sync is off or not set up. Cached until settings change. */
  getSync(): Promise<SyncHandle | null>;
};

export type ServicesOptions = {
  /** Test seams for the AI service: on-device engine, model registry, download plumbing, preferences. */
  ai?: Pick<AiServiceOptions, 'onDevice' | 'registry' | 'downloadFs' | 'downloadFetch' | 'prefs'>;
  secure?: SecureStore;
  /** Use this database instead of opening one (tests). It is wrapped, and seeded unless seed is false. */
  db?: BacchatDb;
  /** Seed the design's sample data into an empty db. Default true. The app passes false: it starts empty and seeds only on request (seedSample). */
  seed?: boolean;
  /** Fixed clock. Overrides the sample-day logic. */
  now?: () => number;
  fetch?: typeof fetch;
  navFetch?: NavFetch;
  syncFetch?: FetchLike;
  /** Reads and saves screenshot image files for 'Original screenshots' sync (tests). */
  shotFiles?: ShotFiles;
  /** Replaces the Google token provider (tests). */
  googleTokens?: GoogleTokenProvider;
  sodium?: () => Promise<SodiumLike>;
  probe?: NetworkProbe;
  /** Name of the SQLite file. */
  dbName?: string;
  /** Override how the SQLite file is opened (tests). */
  open?: OpenOptions['open'];
};

/** Empty the persisted stores that hold user data. First-run and preferences stay; only the NAV refresh day is cleared. */
function resetUserStores(): void {
  useGoalPlans.getState().clear();
  useBudget.getState().clear();
  useBudgetAlerts.getState().clear();
  usePreferences.getState().setLastNavRefreshDay(null);
}

type BuildState = { dbError: string | null; sample: boolean; ready: () => Promise<void> };

function build(raw: BacchatDb, opts: ServicesOptions, state: BuildState): Services {
  const secure = opts.secure ?? createExpoSecureStore();
  const settings = createSettings(secure);
  const db = observeDb(raw);
  const fetchImpl = (opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a))) as typeof fetch;
  const navFetch = (opts.navFetch ?? ((url, init) => fetchImpl(url, init as RequestInit))) as NavFetch;
  const navClient = createNavClient({ fetch: navFetch, npsUrl: () => usePreferences.getState().npsNavUrl || getNpsNavUrlDefault() });
  const realNow = (): number => (opts.now ? opts.now() : Date.now());

  let advisor: Advisor | null = null;
  let syncKey = '';
  const google = opts.googleTokens ?? createGoogleTokenProvider({ secure, clientId: getGoogleClientId });
  let sync: SyncHandle | null = null;
  const ai = createAiService({ secure, settings, db, fetch: fetchImpl, probe: opts.probe, ...opts.ai });
  ai.subscribe(() => {
    advisor = null;
  });
  settings.subscribe(() => {
    syncKey = '';
  });

  const services: Services = {
    db,
    navClient,
    secure,
    settings,
    google,
    dbKind: raw.kind,
    dbError: state.dbError,
    now: () => (opts.now ? opts.now() : state.sample ? SAMPLE_TODAY : Date.now()),
    isSample: () => state.sample && !opts.now,
    async exitSampleMode() {
      state.sample = false;
      await raw.meta.set(SAMPLE_EXITED_FLAG, '1');
      db.notify();
    },
    async clearAllData() {
      // A lazy test seed must finish before the wipe, or it would refill the notebook afterwards.
      await state.ready();
      await db.wipe();
      await seedStandardCategories(raw);
      resetUserStores();
      // Sync bookkeeping describes rows that no longer exist; the next sync starts from the cloud copy.
      await resetSyncBookkeeping();
      // Forget the sync link too, otherwise the next sync would pull the old data straight back from the cloud.
      await settings.setSyncConfig(null);
      sync = null;
      syncKey = '';
      await services.exitSampleMode();
      advisor = null;
    },
    async seedSample() {
      await state.ready();
      const [accounts, entries, goals] = await Promise.all([db.accounts.list(), db.entries.list(), db.goals.list()]);
      if (accounts.length + entries.length + goals.length > 0) return false;
      await seedFromSampleData(raw);
      await raw.meta.set(SAMPLE_EXITED_FLAG, '0');
      state.sample = true;
      useGoalPlans.getState().reset();
      useBudget.getState().reset();
      db.notify();
      return true;
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

    ai,

    async createAdvisor() {
      // The routed provider reads the current mode, keys and consent on every call; the advisor is rebuilt on any change anyway.
      if (!(await ai.canAdvise())) return null;
      advisor ??= createAdvisor({ provider: ai.advisorProvider(), db, now: services.now });
      return advisor;
    },

    async getSync() {
      if (!settings.isSyncEnabled()) return null;
      const config = await settings.getSyncConfig();
      if (!config) return null;
      const k = `${config.baseUrl}|${config.token}|${config.deviceId}|${JSON.stringify(config.target ?? null)}|${Array.from(config.masterKey).join(',')}`;
      if (sync && k === syncKey) return sync;
      const sodium = await (opts.sodium ?? loadSodium)();
      const client = createTarget(config, config.target, {
        fetch: opts.syncFetch,
        tokens: google as AccessTokenProvider,
        deviceId: config.deviceId,
      });
      const cipher = new BlobCipher(sodium, config.masterKey);
      const engine = new SyncEngine({
        client,
        cipher,
        data: createLocalDataSource(db),
        state: createSyncStateStore(),
        options: () => settings.getSyncOptions(),
        probe: opts.probe,
        onProgress: (p) => useSyncStatus.getState().setProgress(p),
      });
      const run = async (): Promise<SyncResult | null> => {
        const result = await runSyncWithStatus(engine, client);
        // Image bytes follow the metadata, only when "Original screenshots" is on.
        if (result?.status === 'synced' && settings.getSyncOptions().shots) {
          const files = opts.shotFiles ?? expoShotFiles();
          if (files) {
            try {
              await syncShotImages({ target: client, cipher, db, files });
            } catch {
              // Metadata is already synced; images are retried on the next run.
            }
          }
        }
        return result;
      };
      sync = { client, engine, cipher, config, run };
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
      raw = await openBacchatDb({ name: opts.dbName, open: opts.open, keyProvider: createDbKeyProvider(secure) });
    } catch (e) {
      dbError = e instanceof Error ? e.message : 'Could not open the database.';
      raw = createMemoryDb();
    }
  }
  try {
    await ensureOpeningBalances(raw);
  } catch {
    // Balances then fall back to the stored figures.
  }
  let sample = false;
  try {
    // New installs (seed: false) start empty with just the standard categories; the sample is only
    // added when the person asks for it on Welcome. A database seeded earlier stays in sample mode.
    if (opts.seed !== false) await seedIfEmpty(raw);
    else if ((await raw.categories.list()).length === 0) await seedStandardCategories(raw);
    sample = (await raw.meta.get(SEED_FLAG)) === '1' && (await raw.meta.get(SAMPLE_EXITED_FLAG)) !== '1';
  } catch (e) {
    dbError ??= e instanceof Error ? e.message : 'Could not prepare the database.';
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
