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

/** Async CRUD over one table. Deletes are tombstones; list() hides them. */
export interface Repository<T extends BaseRecord> {
  get(id: string): Promise<T | null>;
  /** Live (not deleted) records. */
  list(): Promise<T[]>;
  /** Insert or replace. Stamps updatedAt from the database clock and returns the stored record. */
  put(item: NewRecord<T>): Promise<T>;
  putMany(items: NewRecord<T>[]): Promise<T[]>;
  /** Soft delete (tombstone). No-op for unknown ids. */
  remove(id: string): Promise<void>;
  /** Records (including tombstones) changed after ts. For sync. */
  changedSince(ts: number): Promise<T[]>;
}

export interface EntryRepository extends Repository<Entry> {
  /** Live entries with from <= at < to, newest first. */
  between(fromMs: number, toMs: number): Promise<Entry[]>;
  /** Add a source to an existing entry (a second source after a Matched import). */
  addSource(entryId: string, source: EntrySourceRef): Promise<Entry | null>;
  /** toReview -> confirmed. */
  confirm(entryId: string): Promise<Entry | null>;
  /** Live entries awaiting review, newest first. */
  toReview(): Promise<Entry[]>;
}

export interface MerchantRepository extends Repository<MerchantHistory> {
  /** Find by normalised name. */
  byName(name: string): Promise<MerchantHistory | null>;
  /** Learn from an entry: bump count and total, remember the latest category. */
  record(name: string, categoryId: string | null, amountPaise: number, at: number): Promise<MerchantHistory>;
}

export interface AlertLogRepository extends Repository<BudgetAlertLog> {
  has(categoryId: string, month: string): Promise<boolean>;
  record(categoryId: string, month: string, firedAt: number): Promise<BudgetAlertLog>;
}

/** Small key-value store for preferences kept next to the data (schema version, flags). */
export interface MetaStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface BacchatDb {
  readonly kind: 'memory' | 'sqlite';
  accounts: Repository<Account>;
  debts: Repository<DebtCard>;
  entries: EntryRepository;
  categories: Repository<Category>;
  merchants: MerchantRepository;
  goals: Repository<Goal>;
  allocations: Repository<GoalAllocation>;
  budgets: Repository<Budget>;
  recurring: Repository<Recurring>;
  upiIds: Repository<UpiId>;
  holdings: Repository<FundHolding>;
  alerts: AlertLogRepository;
  meta: MetaStore;
  close(): Promise<void>;
}

export type DbOptions = {
  /** Clock for updatedAt stamps. Defaults to Date.now. */
  now?: () => number;
};
