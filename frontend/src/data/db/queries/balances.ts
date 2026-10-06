import type { BacchatDb, Repository } from '../repositories';
import type { Account, DebtCard, Entry, UpiId } from '../models';

/**
 * Balances follow entries. Nothing writes a running balance: the current balance of a bank or cash
 * account is openingBalancePaise plus the effect of every live entry, and the dues of a card or loan
 * are openingOutstandingPaise plus its entries. Editing or deleting an entry therefore always
 * leaves the totals consistent.
 *
 * Effects, for an entry that moves through account A:
 *  - bank, cash, fund: out lowers the balance, in raises it.
 *  - card, loan (debt): out raises the dues, in (a refund or payment) lowers them.
 *  - moved (transferToAccountId = B): out of A, in to B, using the rules above on each side.
 */
export type AccountDelta = { accountId: string; deltaPaise: number };

const isDebtKind = (k: Account['kind']): boolean => k === 'card' || k === 'loan';

type Ctx = { accounts: Map<string, Account>; upis: Map<string, UpiId>; cashId: string | null };

function ctxOf(accounts: Account[], upis: UpiId[]): Ctx {
  return {
    accounts: new Map(accounts.map((a) => [a.id, a])),
    upis: new Map(upis.map((u) => [u.id, u])),
    cashId: accounts.find((a) => a.kind === 'cash')?.id ?? null,
  };
}

/** The account an entry really moves: its own, else the UPI id's linked account, else the cash wallet for cash. */
function resolveAccountId(e: Entry, ctx: Ctx): string | null {
  if (e.accountId && ctx.accounts.has(e.accountId)) return e.accountId;
  if (e.method === 'upi' && e.upiId) {
    const linked = ctx.upis.get(e.upiId)?.accountId;
    if (linked && ctx.accounts.has(linked)) return linked;
  }
  if (e.method === 'cash') return ctx.cashId;
  return null;
}

/** Signed effect of one entry on each account it touches: asset balance change, or change in dues for card and loan accounts. */
export function entryDeltas(e: Entry, accounts: Account[], upis: UpiId[] = []): AccountDelta[] {
  return deltasWith(e, ctxOf(accounts, upis));
}

function deltasWith(e: Entry, ctx: Ctx): AccountDelta[] {
  const out: AccountDelta[] = [];
  const from = resolveAccountId(e, ctx);
  const to = e.transferToAccountId && ctx.accounts.has(e.transferToAccountId) ? e.transferToAccountId : null;
  const apply = (id: string, direction: 'in' | 'out'): void => {
    const kind = ctx.accounts.get(id)?.kind;
    if (!kind) return;
    const sign = isDebtKind(kind) ? (direction === 'out' ? 1 : -1) : direction === 'out' ? -1 : 1;
    out.push({ accountId: id, deltaPaise: sign * e.amountPaise });
  };
  if (from) apply(from, e.direction);
  if (to) apply(to, 'in');
  return out;
}

/** Sum of entry effects per account id. */
export function sumDeltas(entries: Entry[], accounts: Account[], upis: UpiId[] = []): Map<string, number> {
  const ctx = ctxOf(accounts, upis);
  const sums = new Map<string, number>();
  for (const e of entries) {
    if (e.deletedAt) continue;
    for (const d of deltasWith(e, ctx)) sums.set(d.accountId, (sums.get(d.accountId) ?? 0) + d.deltaPaise);
  }
  return sums;
}

/**
 * Current balance of an account. Legacy accounts (no opening balance yet) keep their stored figure;
 * everything else is opening plus entries.
 */
export const currentBalance = (a: Account, sums: Map<string, number>): number =>
  a.openingBalancePaise == null ? a.balancePaise : a.openingBalancePaise + (sums.get(a.id) ?? 0);
export const currentOutstanding = (d: DebtCard, sums: Map<string, number>): number =>
  d.openingOutstandingPaise == null ? d.outstandingPaise : d.openingOutstandingPaise + (sums.get(d.accountId) ?? 0);

export type Ledger = { accounts: Account[]; debts: DebtCard[] };

/**
 * Accounts and debts with balancePaise and outstandingPaise replaced by the derived current values.
 * A card or loan account that has entries but no DebtCard gets one made up (not stored) so its dues
 * are never lost. Pure: reads only.
 */
export async function ledger(db: BacchatDb): Promise<Ledger> {
  const [accounts, debts, entries, upis] = await Promise.all([
    db.accounts.list(),
    db.debts.list(),
    db.entries.list(),
    db.upiIds.list(),
  ]);
  const sums = sumDeltas(entries, accounts, upis);
  const outAccounts = accounts.map((a) => (isDebtKind(a.kind) ? a : { ...a, balancePaise: currentBalance(a, sums) }));
  const outDebts: DebtCard[] = debts.map((d) => ({ ...d, outstandingPaise: currentOutstanding(d, sums) }));
  const haveDebt = new Set(debts.map((d) => d.accountId));
  for (const a of accounts) {
    if (!isDebtKind(a.kind) || haveDebt.has(a.id) || a.openingBalancePaise == null) continue;
    const delta = sums.get(a.id) ?? 0;
    if (delta === 0) continue;
    outDebts.push({ id: `debt-${a.id}`, updatedAt: 0, accountId: a.id, dueDay: 1, outstandingPaise: delta, limitPaise: 0 });
  }
  return { accounts: outAccounts, debts: outDebts };
}

export async function accountsWithBalances(db: BacchatDb): Promise<Account[]> {
  return (await ledger(db)).accounts;
}

export async function debtsWithOutstanding(db: BacchatDb): Promise<DebtCard[]> {
  return (await ledger(db)).debts;
}

export const BALANCES_FLAG = 'balances.derived.v1';

/**
 * One-time upgrade for a database made before balances followed entries: its stored balances already
 * include every entry, so the opening balance is the stored one minus what the entries did.
 * Seeded and new accounts set their own opening balance and are skipped.
 */
export async function ensureOpeningBalances(db: BacchatDb): Promise<boolean> {
  if ((await db.meta.get(BALANCES_FLAG)) === '1') return false;
  if ((await db.accounts.list()).length === 0) return false; // nothing to upgrade yet; new accounts set their own
  await rebaseOpeningBalances(db);
  await db.meta.set(BALANCES_FLAG, '1');
  return true;
}

/** Give every account and debt without an opening figure one that keeps today's totals unchanged. */
export async function rebaseOpeningBalances(db: BacchatDb): Promise<void> {
  const [accounts, debts, entries, upis] = await Promise.all([
    db.accounts.list(),
    db.debts.list(),
    db.entries.list(),
    db.upiIds.list(),
  ]);
  const sums = sumDeltas(entries, accounts, upis);
  for (const a of accounts) {
    if (a.openingBalancePaise != null) continue;
    // Debt accounts keep their dues on the DebtCard; a zero here only marks the account as derived.
    await db.accounts.put({ ...a, openingBalancePaise: isDebtKind(a.kind) ? 0 : a.balancePaise - (sums.get(a.id) ?? 0) });
  }
  for (const d of debts) {
    if (d.openingOutstandingPaise != null) continue;
    await db.debts.put({ ...d, openingOutstandingPaise: d.outstandingPaise - (sums.get(d.accountId) ?? 0) });
  }
}

/**
 * Decorates the account and debt repositories so that writing a different balancePaise (or
 * outstandingPaise) onto a derived record means "the balance is now this": the opening figure is
 * re-based so that opening plus entries equals what was written. Everything else passes through.
 */
export function withDerivedBalances(db: BacchatDb): BacchatDb {
  const sums = async (): Promise<Map<string, number>> => {
    const [accounts, entries, upis] = await Promise.all([db.accounts.list(), db.entries.list(), db.upiIds.list()]);
    return sumDeltas(entries, accounts, upis);
  };
  const accounts: Repository<Account> = Object.create(db.accounts) as Repository<Account>;
  accounts.put = async (item) => {
    const prev = await db.accounts.get(item.id);
    if (prev && prev.openingBalancePaise != null && item.openingBalancePaise === prev.openingBalancePaise && item.balancePaise !== prev.balancePaise && !isDebtKind(item.kind)) {
      const s = await sums();
      return db.accounts.put({ ...item, openingBalancePaise: item.balancePaise - (s.get(item.id) ?? 0) });
    }
    return db.accounts.put(item);
  };
  accounts.putMany = async (items) => {
    const out: Account[] = [];
    for (const i of items) out.push(await accounts.put(i));
    return out;
  };
  const debts: Repository<DebtCard> = Object.create(db.debts) as Repository<DebtCard>;
  debts.put = async (item) => {
    const prev = await db.debts.get(item.id);
    if (prev && prev.openingOutstandingPaise != null && item.openingOutstandingPaise === prev.openingOutstandingPaise && item.outstandingPaise !== prev.outstandingPaise) {
      const s = await sums();
      return db.debts.put({ ...item, openingOutstandingPaise: item.outstandingPaise - (s.get(item.accountId) ?? 0) });
    }
    return db.debts.put(item);
  };
  debts.putMany = async (items) => {
    const out: DebtCard[] = [];
    for (const i of items) out.push(await debts.put(i));
    return out;
  };
  return { ...db, accounts, debts };
}
