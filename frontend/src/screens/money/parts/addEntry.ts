/** Pure helpers for k5: paid-from options, payee suggestions from history and building the Entry to save. */
import type { Account, BacchatDb, Category, Entry, EntryDirection, MerchantHistory, PayMethod, UpiId } from '../../../data/db';
import { newId } from '../../../data/db/ids';
import { t } from '../../../lib/i18n';
import type { Payee } from './payees';

export type MethodOption = { key: string; label: string; method: PayMethod; accountId: string | null; upiId: string | null };

/** The choice is the account the money came from; the method is only kept inside the entry. */
export const methodKey = (method: PayMethod, accountId: string | null | undefined, _upiId?: string | null): string =>
  accountId ? `acc|${accountId}` : `none|${method === 'cash' ? 'cash' : ''}`;

const METHOD_OF: Record<Account['kind'], PayMethod> = { card: 'card', bank: 'bank', cash: 'cash', mf: 'bank', nps: 'bank', loan: 'bank' };

/**
 * "Paid from" choices: one per account money can leave (cards, banks, cash). UPI, debit card or
 * net banking all take money from one of these, so the method is not a choice (owner request).
 */
export function buildMethodOptions(accounts: readonly Account[], _upis: readonly UpiId[] = []): MethodOption[] {
  const out: MethodOption[] = [];
  const live = accounts.filter((a) => !a.deletedAt && (a.kind === 'card' || a.kind === 'bank' || a.kind === 'cash'));
  const order: Account['kind'][] = ['card', 'bank', 'cash'];
  for (const kind of order) {
    for (const a of live.filter((x) => x.kind === kind)) out.push({ key: methodKey(METHOD_OF[a.kind], a.id), label: a.name, method: METHOD_OF[a.kind], accountId: a.id, upiId: null });
  }
  if (!live.some((a) => a.kind === 'cash')) out.push({ key: methodKey('cash', null), label: t('moneyLive.cash'), method: 'cash', accountId: null, upiId: null });
  return out;
}

/** Past payees, most used first, with their usual category. */
export function payeesFromHistory(history: readonly MerchantHistory[], cats: ReadonlyMap<string, Category>): (Payee & { categoryId: string | null })[] {
  return [...history]
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count || b.lastAt - a.lastAt)
    .map((h) => {
      const c = h.categoryId ? cats.get(h.categoryId) : undefined;
      return { name: h.name, icon: c?.icon ?? 'storefront', category: c?.name ?? t('moneyLive.noCategory'), categoryId: h.categoryId, times: h.count };
    });
}

export type EntryForm = {
  id?: string;
  kind: 'spent' | 'got' | 'moved';
  amountPaise: number;
  payee: string;
  categoryId: string | null;
  /** Budget the spend is tagged with, if any. */
  budgetId?: string | null;
  option: MethodOption;
  at: number;
  note: string;
  /** When editing: the stored entry, so sources, status and flags stay as they were. */
  base?: Entry | null;
};

const DIRECTION: Record<EntryForm['kind'], EntryDirection> = { spent: 'out', got: 'in', moved: 'out' };

/** The Entry a filled-in form describes. By hand, confirmed. */
export function entryFromForm(f: EntryForm): Entry {
  const note = f.note.trim() || null;
  const common = {
    amountPaise: f.amountPaise,
    direction: DIRECTION[f.kind],
    at: f.at,
    merchant: f.payee.trim(),
    note,
    categoryId: f.categoryId,
    budgetId: f.kind === 'spent' ? f.budgetId ?? null : null,
    accountId: f.option.accountId,
    method: f.option.method,
    upiId: f.option.upiId,
  };
  if (f.base) return { ...f.base, ...common, updatedAt: f.base.updatedAt };
  return { id: f.id ?? newId('e'), updatedAt: 0, sources: [{ kind: 'hand' }], status: 'confirmed', aiAdded: false, ...common };
}

/** Write the entry and teach the merchant history its category. */
export async function saveEntry(db: BacchatDb, f: EntryForm): Promise<Entry> {
  const entry = entryFromForm(f);
  const stored = await db.entries.put(entry);
  if (stored.direction === 'out') await db.merchants.record(stored.merchant, stored.categoryId, stored.amountPaise, stored.at);
  return stored;
}
