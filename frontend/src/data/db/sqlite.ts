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
import type { SqlDriver, SqlValue } from './driver';
import { runMigrations } from './schema';
import { newId } from './ids';
import { merchantKey, mergeMerchant } from './merchantKey';

type Row = { json: string };
type Extra<T> = (item: T) => Record<string, SqlValue>;

class SqliteRepo<T extends BaseRecord> implements Repository<T> {
  constructor(
    protected d: SqlDriver,
    protected table: string,
    protected now: () => number,
    protected extra: Extra<T> = () => ({}),
  ) {}

  protected async raw(id: string): Promise<T | null> {
    const rows = await this.d.all<Row>(`SELECT json FROM ${this.table} WHERE id = ?`, [id]);
    return rows[0] ? (JSON.parse(rows[0].json) as T) : null;
  }
  async get(id: string): Promise<T | null> {
    const r = await this.raw(id);
    return r && !r.deletedAt ? r : null;
  }
  async list(): Promise<T[]> {
    const rows = await this.d.all<Row>(`SELECT json FROM ${this.table} WHERE deletedAt IS NULL ORDER BY updatedAt, id`);
    return rows.map((r) => JSON.parse(r.json) as T);
  }
  protected async write(stored: T): Promise<void> {
    const extra = this.extra(stored);
    const cols = ['id', 'updatedAt', 'deletedAt', 'json', ...Object.keys(extra)];
    const vals: SqlValue[] = [stored.id, stored.updatedAt, stored.deletedAt ?? null, JSON.stringify(stored), ...Object.values(extra)];
    await this.d.run(
      `INSERT OR REPLACE INTO ${this.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      vals,
    );
  }
  async put(item: NewRecord<T>): Promise<T> {
    const stored = { ...item, deletedAt: null, updatedAt: this.now() } as T;
    await this.write(stored);
    return stored;
  }
  async putMany(items: NewRecord<T>[]): Promise<T[]> {
    const out: T[] = [];
    await this.d.exec('BEGIN');
    try {
      for (const i of items) out.push(await this.put(i));
      await this.d.exec('COMMIT');
    } catch (e) {
      await this.d.exec('ROLLBACK');
      throw e;
    }
    return out;
  }
  async remove(id: string): Promise<void> {
    const r = await this.raw(id);
    if (!r || r.deletedAt) return;
    const t = this.now();
    await this.write({ ...r, deletedAt: t, updatedAt: t });
  }
  async changedSince(ts: number): Promise<T[]> {
    const rows = await this.d.all<Row>(`SELECT json FROM ${this.table} WHERE updatedAt > ? ORDER BY updatedAt, id`, [ts]);
    return rows.map((r) => JSON.parse(r.json) as T);
  }
}

class SqliteEntries extends SqliteRepo<Entry> implements EntryRepository {
  constructor(d: SqlDriver, now: () => number) {
    super(d, 'entries', now, (e) => ({
      at: e.at,
      accountId: e.accountId,
      categoryId: e.categoryId,
      status: e.status,
    }));
  }
  async between(fromMs: number, toMs: number): Promise<Entry[]> {
    const rows = await this.d.all<Row>(
      'SELECT json FROM entries WHERE deletedAt IS NULL AND at >= ? AND at < ? ORDER BY at DESC, id',
      [fromMs, toMs],
    );
    return rows.map((r) => JSON.parse(r.json) as Entry);
  }
  async addSource(entryId: string, source: EntrySourceRef): Promise<Entry | null> {
    const e = await this.get(entryId);
    if (!e) return null;
    if (e.sources.some((s) => s.kind === source.kind && (s.rawRef ?? null) === (source.rawRef ?? null))) return e;
    return this.put({ ...e, sources: [...e.sources, source] });
  }
  async confirm(entryId: string): Promise<Entry | null> {
    const e = await this.get(entryId);
    return e ? this.put({ ...e, status: 'confirmed' }) : null;
  }
  async toReview(): Promise<Entry[]> {
    const rows = await this.d.all<Row>(
      "SELECT json FROM entries WHERE deletedAt IS NULL AND status = 'toReview' ORDER BY at DESC, id",
    );
    return rows.map((r) => JSON.parse(r.json) as Entry);
  }
}

class SqliteMerchants extends SqliteRepo<MerchantHistory> implements MerchantRepository {
  constructor(d: SqlDriver, now: () => number) {
    super(d, 'merchants', now, (m) => ({ key: m.key }));
  }
  async byName(name: string): Promise<MerchantHistory | null> {
    const rows = await this.d.all<Row>('SELECT json FROM merchants WHERE deletedAt IS NULL AND key = ? LIMIT 1', [
      merchantKey(name),
    ]);
    return rows[0] ? (JSON.parse(rows[0].json) as MerchantHistory) : null;
  }
  async record(name: string, categoryId: string | null, amountPaise: number, at: number): Promise<MerchantHistory> {
    return this.put(mergeMerchant(await this.byName(name), name, categoryId, amountPaise, at));
  }
}

class SqliteAlerts extends SqliteRepo<BudgetAlertLog> implements AlertLogRepository {
  constructor(d: SqlDriver, now: () => number) {
    super(d, 'alerts', now, (a) => ({ categoryId: a.categoryId, month: a.month }));
  }
  async has(categoryId: string, month: string): Promise<boolean> {
    const rows = await this.d.all<Row>(
      'SELECT json FROM alerts WHERE deletedAt IS NULL AND categoryId = ? AND month = ? LIMIT 1',
      [categoryId, month],
    );
    return rows.length > 0;
  }
  async record(categoryId: string, month: string, firedAt: number): Promise<BudgetAlertLog> {
    return this.put({ id: newId('al'), categoryId, month, firedAt });
  }
}

class SqliteMeta implements MetaStore {
  constructor(private d: SqlDriver) {}
  async get(key: string): Promise<string | null> {
    const rows = await this.d.all<{ v: string }>('SELECT v FROM meta WHERE k = ?', [key]);
    return rows[0]?.v ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    await this.d.run('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)', [key, value]);
  }
}

/**
 * Open the repositories on an already-opened driver, migrating the schema first.
 * The driver is expected to be unlocked already (SQLCipher key applied by the opener).
 */
export async function createSqliteDb(driver: SqlDriver, opts: DbOptions = {}): Promise<BacchatDb> {
  await runMigrations(driver);
  const now = opts.now ?? Date.now;
  return {
    kind: 'sqlite',
    accounts: new SqliteRepo<Account>(driver, 'accounts', now),
    debts: new SqliteRepo<DebtCard>(driver, 'debts', now),
    entries: new SqliteEntries(driver, now),
    categories: new SqliteRepo<Category>(driver, 'categories', now),
    merchants: new SqliteMerchants(driver, now),
    goals: new SqliteRepo<Goal>(driver, 'goals', now),
    allocations: new SqliteRepo<GoalAllocation>(driver, 'allocations', now),
    budgets: new SqliteRepo<Budget>(driver, 'budgets', now),
    recurring: new SqliteRepo<Recurring>(driver, 'recurring', now),
    upiIds: new SqliteRepo<UpiId>(driver, 'upi_ids', now),
    holdings: new SqliteRepo<FundHolding>(driver, 'holdings', now),
    alerts: new SqliteAlerts(driver, now),
    meta: new SqliteMeta(driver),
    close: () => driver.close(),
  };
}
