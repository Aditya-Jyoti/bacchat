/** Pure helpers for k5: method options, payee suggestions from history and building the Entry to save. */
import type { Account, BacchatDb, Category, Entry, EntryDirection, MerchantHistory, PayMethod, UpiId } from '../../../data/db';
import { newId } from '../../../data/db/ids';
import { t } from '../../../lib/i18n';
import type { Payee } from './payees';

export type MethodOption = { key: string; label: string; method: PayMethod; accountId: string | null; upiId: string | null };

export const methodKey = (method: PayMethod, accountId: string | null | undefined, upiId: string | null | undefined): string =>
  `${method}|${accountId ?? ''}|${upiId ?? ''}`;

/** Paid-with choices from what the user has: UPI ids, cards, banks (debit and transfer) and cash. */
export function buildMethodOptions(accounts: readonly Account[], upis: readonly UpiId[]): MethodOption[] {
  const out: MethodOption[] = [];
  const opt = (label: string, method: PayMethod, accountId: string | null, upiId: string | null): void => {
    out.push({ key: methodKey(method, accountId, upiId), label, method, accountId, upiId });
  };
  for (const u of upis) opt(`UPI \u00B7 ${u.handle}`, 'upi', u.accountId ?? null, u.id);
  for (const a of accounts.filter((x) => x.kind === 'card')) opt(a.name, 'card', a.id, null);
  for (const a of accounts.filter((x) => x.kind === 'bank')) {
    if (a.last4) opt(t('moneyLive.debitOf', { name: a.name }), 'debit', a.id, null);
    opt(a.name, 'bank', a.id, null);
  }
  const cash = accounts.find((x) => x.kind === 'cash');
  opt(t('moneyLive.cash'), 'cash', cash?.id ?? null, null);
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
