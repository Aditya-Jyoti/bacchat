/**
 * Sync plumbing over the repositories: a LocalDataSource that maps the engine's data sets to
 * repositories (with ISO timestamps and tombstones), and a SyncStateStore over lib/storage.
 *
 * Data set mapping (see BLOBS_BY_OPTION in lib/sync/engine.ts):
 *   entries     -> entries
 *   accounts    -> accounts, debts, holdings, upiIds   (ids prefixed with the table: "debts:debt-1")
 *   goals       -> goals, allocations, recurring       (prefixed)
 *   budgets     -> budgets
 *   categories  -> categories
 *   rules       -> merchants (learned payee rules)
 *   screenshots -> screenshots (metadata only; the phone's file path never leaves it)
 *   asks        -> asks (Ask Bacchat history)
 * Budget alert logs stay on the phone.
 */
import type { BacchatDb } from '../data/db';
import type { BaseRecord, NewRecord } from '../data/db/models';
import type { Repository } from '../data/db/repositories';
import type { BlobSyncState, LocalDataSource, SyncStateStore } from '../lib/sync/engine';
import type { DataSetName, SyncRecord } from '../lib/sync/merge';
import { getJSON, setJSON } from '../lib/storage';

type Table = {
  table: string;
  repo: Repository<BaseRecord>;
  /** Fields that stay on this phone: dropped when reading for sync, kept (or defaulted) when a pulled row is written. */
  localOnly?: Record<string, unknown>;
};

function tablesFor(db: BacchatDb, name: DataSetName): { prefixed: boolean; tables: Table[] } {
  const t = (table: string, repo: unknown, localOnly?: Record<string, unknown>): Table => ({ table, repo: repo as Repository<BaseRecord>, localOnly });
  switch (name) {
    case 'entries':
      return { prefixed: false, tables: [t('entries', db.entries)] };
    case 'accounts':
      return {
        prefixed: true,
        tables: [t('accounts', db.accounts), t('debts', db.debts), t('holdings', db.holdings), t('upiIds', db.upiIds)],
      };
    case 'goals':
      return {
        prefixed: true,
        tables: [t('goals', db.goals), t('allocations', db.allocations), t('recurring', db.recurring)],
      };
    case 'budgets':
      return { prefixed: false, tables: [t('budgets', db.budgets)] };
    case 'categories':
      return { prefixed: false, tables: [t('categories', db.categories)] };
    case 'rules':
      return { prefixed: false, tables: [t('merchants', db.merchants)] };
    case 'screenshots':
      return { prefixed: false, tables: [t('screenshots', db.screenshots, { uri: '' })] };
    case 'asks':
      return { prefixed: false, tables: [t('asks', db.asks)] };
    default:
      return { prefixed: false, tables: [] };
  }
}

const iso = (ms: number): string => new Date(ms).toISOString();
const APPLIED_KEY = 'bacchat.sync.applied';

type Applied = Record<string, [number, number]>;

/**
 * The repositories stamp updatedAt from their own clock, so rows written from a pull get a new
 * local time. We remember (local stamp -> remote stamp) so the next read reports the remote time
 * and the engine does not push the same rows back.
 */
export function createLocalDataSource(db: BacchatDb): LocalDataSource {
  let applied: Applied | null = null;
  const load = async (): Promise<Applied> => (applied ??= await getJSON<Applied>(APPLIED_KEY, {}));

  const toSync = (rec: BaseRecord, key: string, id: string, tag: string | null, map: Applied, localOnly?: Record<string, unknown>): SyncRecord => {
    const { updatedAt, deletedAt, ...rest } = rec as BaseRecord & Record<string, unknown>;
    for (const f of Object.keys(localOnly ?? {})) delete rest[f];
    const a = map[key];
    const stamp = a && a[0] === updatedAt ? a[1] : updatedAt;
    const out: SyncRecord = { ...rest, id, updatedAt: iso(stamp), deletedAt: deletedAt ? iso(stamp) : null };
    if (tag) out._t = tag;
    return out;
  };

  const source: LocalDataSource = {
    async read(name) {
      const { prefixed, tables } = tablesFor(db, name);
      const map = await load();
      const out: SyncRecord[] = [];
      for (const { table, repo, localOnly } of tables) {
        for (const rec of await repo.changedSince(0)) {
          const key = `${table}:${rec.id}`;
          out.push(toSync(rec, key, prefixed ? key : rec.id, prefixed ? table : null, map, localOnly));
        }
      }
      return out;
    },

    async write(name, records) {
      const { prefixed, tables } = tablesFor(db, name);
      if (tables.length === 0) return;
      const map = await load();
      const byTable = new Map(tables.map((t) => [t.table, t] as const));
      const current = new Map((await source.read(name)).map((r) => [r.id, r] as const));
      const touched: { table: Table; id: string; remoteMs: number }[] = [];
      for (const r of records) {
        const same = current.get(r.id);
        if (same && JSON.stringify(sortKeys(same)) === JSON.stringify(sortKeys(r))) continue;
        const table = byTable.get(prefixed ? String(r._t ?? '') : tables[0].table);
        if (!table) continue;
        const rawId = prefixed ? r.id.slice(table.table.length + 1) : r.id;
        const { _t, updatedAt, deletedAt, id: _id, ...fields } = r;
        void _t;
        void _id;
        const remoteMs = Date.parse(deletedAt ?? updatedAt) || Date.parse(updatedAt) || 0;
        let kept: Record<string, unknown> = {};
        if (table.localOnly) {
          const cur = (await table.repo.get(rawId)) as unknown as Record<string, unknown> | null;
          kept = Object.fromEntries(Object.entries(table.localOnly).map(([f, d]) => [f, cur?.[f] ?? d]));
        }
        await table.repo.put({ ...fields, ...kept, id: rawId } as NewRecord<BaseRecord>);
        if (deletedAt) await table.repo.remove(rawId);
        touched.push({ table, id: rawId, remoteMs });
      }
      if (touched.length === 0) return;
      for (const t of new Set(touched.map((x) => x.table))) {
        const stored = new Map((await t.repo.changedSince(0)).map((x) => [x.id, x.updatedAt] as const));
        for (const x of touched.filter((y) => y.table === t)) {
          const local = stored.get(x.id);
          if (local != null) map[`${t.table}:${x.id}`] = [local, x.remoteMs];
        }
      }
      await setJSON(APPLIED_KEY, map);
    },
  };
  return source;
}

function sortKeys(r: SyncRecord): Record<string, unknown> {
  return Object.fromEntries(Object.entries(r).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** Per-data-set sync bookkeeping (server version and merge base) in the key-value store. */
export function createSyncStateStore(): SyncStateStore {
  const key = (n: DataSetName): string => `bacchat.sync.state.${n}`;
  return {
    async get(name) {
      return getJSON<BlobSyncState | null>(key(name), null);
    },
    async set(name, state) {
      await setJSON(key(name), state);
    },
  };
}
