import type {
  Account,
  BaseRecord,
  Budget,
  BudgetAlertLog,
  Category,
  DebtCard,
  Entry,
  EntrySourceRef,
  FundHolding,
  Goal,
  GoalAllocation,
  MerchantHistory,
  NewRecord,
  Recurring,
  AskRecord,
  ScreenshotRecord,
  UpiId,
} from './models';
import type {
  AlertLogRepository,
  BacchatDb,
  DbOptions,
  EntryRepository,
  MerchantRepository,
  MetaStore,
  Repository,
} from './repositories';
import { withDerivedBalances } from './queries/balances';
import { newId } from './ids';
import { merchantKey, mergeMerchant } from './merchantKey';

class MemoryRepo<T extends BaseRecord> implements Repository<T> {
  protected rows = new Map<string, T>();
  constructor(protected now: () => number) {}

  async get(id: string): Promise<T | null> {
    const r = this.rows.get(id);
    return r && !r.deletedAt ? clone(r) : null;
  }
  async list(): Promise<T[]> {
    return [...this.rows.values()].filter((r) => !r.deletedAt).map(clone);
  }
  async put(item: NewRecord<T>): Promise<T> {
    const stored = { ...item, deletedAt: null, updatedAt: this.now() } as T;
    this.rows.set(stored.id, clone(stored));
    return clone(stored);
  }
  async putMany(items: NewRecord<T>[]): Promise<T[]> {
    const out: T[] = [];
    for (const i of items) out.push(await this.put(i));
    return out;
  }
  async remove(id: string): Promise<void> {
    const r = this.rows.get(id);
    if (!r || r.deletedAt) return;
    this.rows.set(id, { ...r, deletedAt: this.now(), updatedAt: this.now() });
  }
  async changedSince(ts: number): Promise<T[]> {
    return [...this.rows.values()].filter((r) => r.updatedAt > ts).map(clone);
  }
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

class MemoryEntries extends MemoryRepo<Entry> implements EntryRepository {
  async between(fromMs: number, toMs: number): Promise<Entry[]> {
    return [...this.rows.values()]
      .filter((e) => !e.deletedAt && e.at >= fromMs && e.at < toMs)
      .sort((a, b) => b.at - a.at)
      .map(clone);
  }
  async addSource(entryId: string, source: EntrySourceRef): Promise<Entry | null> {
    const e = await this.get(entryId);
    if (!e) return null;
    if (e.sources.some((s) => s.kind === source.kind && (s.rawRef ?? null) === (source.rawRef ?? null))) return e;
    return this.put({ ...e, sources: [...e.sources, source] });
  }
  async confirm(entryId: string): Promise<Entry | null> {
    const e = await this.get(entryId);
    if (!e) return null;
    return this.put({ ...e, status: 'confirmed' });
  }
  async toReview(): Promise<Entry[]> {
    return (await this.list()).filter((e) => e.status === 'toReview').sort((a, b) => b.at - a.at);
  }
}

class MemoryMerchants extends MemoryRepo<MerchantHistory> implements MerchantRepository {
  async byName(name: string): Promise<MerchantHistory | null> {
    const key = merchantKey(name);
    return (await this.list()).find((m) => m.key === key) ?? null;
  }
  async record(name: string, categoryId: string | null, amountPaise: number, at: number): Promise<MerchantHistory> {
    const prev = await this.byName(name);
    return this.put(mergeMerchant(prev, name, categoryId, amountPaise, at));
  }
}

class MemoryAlerts extends MemoryRepo<BudgetAlertLog> implements AlertLogRepository {
  async has(categoryId: string, month: string): Promise<boolean> {
    return (await this.list()).some((a) => a.categoryId === categoryId && a.month === month);
  }
  async record(categoryId: string, month: string, firedAt: number): Promise<BudgetAlertLog> {
    return this.put({ id: newId('al'), categoryId, month, firedAt });
  }
}

class MemoryMeta implements MetaStore {
  private m = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.m.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    this.m.set(key, value);
  }
}

/** In-memory database: the default for tests and for the first run before SQLite is ready. */
export function createMemoryDb(opts: DbOptions = {}): BacchatDb {
  const now = opts.now ?? Date.now;
  return withDerivedBalances({
    kind: 'memory',
    accounts: new MemoryRepo<Account>(now),
    debts: new MemoryRepo<DebtCard>(now),
    entries: new MemoryEntries(now),
    categories: new MemoryRepo<Category>(now),
    merchants: new MemoryMerchants(now),
    goals: new MemoryRepo<Goal>(now),
    allocations: new MemoryRepo<GoalAllocation>(now),
    budgets: new MemoryRepo<Budget>(now),
    recurring: new MemoryRepo<Recurring>(now),
    upiIds: new MemoryRepo<UpiId>(now),
    holdings: new MemoryRepo<FundHolding>(now),
    alerts: new MemoryAlerts(now),
    screenshots: new MemoryRepo<ScreenshotRecord>(now),
    asks: new MemoryRepo<AskRecord>(now),
    meta: new MemoryMeta(),
    async close() {},
  });
}
