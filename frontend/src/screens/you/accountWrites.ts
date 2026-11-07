import { accountsWithBalances, ledger, newId, type Account, type BacchatDb, type Repeat } from '../../data/db';
import { t } from '../../lib/i18n';
import type { AccountType } from './sections/accountTypes';

export type NewAccountInput = {
  type: AccountType;
  name: string;
  bank: string;
  last4: string;
  /** Credit limit in paise (cards). */
  limitPaise: number;
  /** Balance, current value or amount owed, in paise. */
  amountPaise: number;
  /** Bill day label such as "18th" (cards). */
  bill: string;
  /** Due day label such as "5th" (cards). */
  due: string;
  /** Which kind of investment (type 'invest' only). Defaults to mutual funds. */
  investKind?: 'mf' | 'nps';
  /** Investments: next payment date YYYY-MM-DD, optional. */
  nextPaymentDate?: string | null;
  /** How that payment repeats. Default every month. */
  paymentRepeat?: Repeat;
};

const dayOf = (label: string): number => Math.min(31, Math.max(1, parseInt(label, 10) || 1));

const KINDS: Record<AccountType, { kind: Account['kind']; icon: string }> = {
  bank: { kind: 'bank', icon: 'account_balance' },
  card: { kind: 'card', icon: 'credit_card' },
  cash: { kind: 'cash', icon: 'payments' },
  invest: { kind: 'mf', icon: 'trending_up' },
  loan: { kind: 'loan', icon: 'request_quote' },
};

/** Write an Account, and a DebtCard for credit cards and loans (debt stays on its own, never netted). Returns the account id. */
export async function addAccount(db: BacchatDb, input: NewAccountInput): Promise<string> {
  const { kind, icon } = input.type === 'invest' && input.investKind === 'nps' ? { kind: 'nps' as const, icon: 'elderly' } : KINDS[input.type];
  const id = newId('acc');
  const hasBank = input.type === 'bank' || input.type === 'card';
  const isDebt = input.type === 'card' || input.type === 'loan';
  const note =
    input.type === 'card'
      ? `${input.bank}, ${t('accountsUi.noteBillOn', { day: input.bill })}`
      : input.type === 'bank'
        ? input.bank
        : null;
  await db.accounts.put({
    id,
    name: input.name.trim(),
    kind,
    icon,
    balancePaise: isDebt ? 0 : input.amountPaise,
    openingBalancePaise: isDebt ? 0 : input.amountPaise,
    // No card digits are asked for any more; kept only if a caller passes them.
    last4: hasBank && input.last4.trim() ? input.last4.trim() : null,
    note,
    nextPaymentDate: input.type === 'invest' ? input.nextPaymentDate ?? null : null,
    paymentRepeat: input.type === 'invest' && input.nextPaymentDate ? input.paymentRepeat ?? 'monthly' : null,
  });
  if (isDebt) {
    await db.debts.put({
      id: newId('debt'),
      accountId: id,
      dueDay: input.type === 'card' ? dayOf(input.due) : 1,
      outstandingPaise: input.amountPaise,
      openingOutstandingPaise: input.amountPaise,
      limitPaise: input.type === 'card' ? input.limitPaise : input.amountPaise,
    });
  }
  return id;
}

export type AccountEdit = {
  id: string;
  name: string;
  bank: string;
  /** Balance (or amount owed for cards and loans) as it should be now, in paise. */
  amountPaise: number;
  limitPaise: number;
  bill: string;
  due: string;
  nextPaymentDate?: string | null;
  paymentRepeat?: Repeat;
};

/**
 * Save changes to an account. A new balance means "the balance is now this": the opening figure is
 * re-based so entries stay as they are (the repositories do that). Cards and loans update their dues.
 */
export async function updateAccount(db: BacchatDb, edit: AccountEdit): Promise<void> {
  const prev = await db.accounts.get(edit.id);
  if (!prev) return;
  const isDebt = prev.kind === 'card' || prev.kind === 'loan';
  const note = prev.kind === 'card' ? `${edit.bank}, ${t('accountsUi.noteBillOn', { day: edit.bill })}` : prev.kind === 'bank' ? edit.bank : prev.note ?? null;
  const current = (await accountsWithBalances(db)).find((a) => a.id === edit.id);
  await db.accounts.put({
    ...prev,
    name: edit.name.trim(),
    note,
    nextPaymentDate: prev.kind === 'mf' || prev.kind === 'nps' ? edit.nextPaymentDate ?? null : prev.nextPaymentDate ?? null,
    paymentRepeat: prev.kind === 'mf' || prev.kind === 'nps' ? edit.paymentRepeat ?? prev.paymentRepeat ?? null : prev.paymentRepeat ?? null,
    // Only a changed balance is written, so an untouched one never shifts the opening figure.
    ...(!isDebt && current && current.balancePaise !== edit.amountPaise ? { balancePaise: edit.amountPaise } : {}),
  });
  if (isDebt) {
    const debt = (await ledger(db)).debts.find((d) => d.accountId === edit.id);
    const stored = debt ? await db.debts.get(debt.id) : null;
    if (debt && stored) {
      await db.debts.put({
        ...stored,
        dueDay: prev.kind === 'card' ? dayOf(edit.due) : stored.dueDay,
        limitPaise: prev.kind === 'card' ? edit.limitPaise : stored.limitPaise,
        ...(debt.outstandingPaise !== edit.amountPaise ? { outstandingPaise: edit.amountPaise } : {}),
      });
    }
  }
}

/**
 * Delete an account. Its entries stay (without an account), its card dues go, and goals kept in
 * it keep their saved amount but are no longer linked to an account.
 */
export async function deleteAccount(db: BacchatDb, id: string): Promise<void> {
  const [entries, debts, allocs, goals] = await Promise.all([db.entries.list(), db.debts.list(), db.allocations.list(), db.goals.list()]);
  for (const e of entries.filter((x) => x.accountId === id)) await db.entries.put({ ...e, accountId: null });
  for (const d of debts.filter((x) => x.accountId === id)) await db.debts.remove(d.id);
  for (const a of allocs.filter((x) => x.accountId === id)) {
    await db.allocations.remove(a.id);
    const keepId = `alloc-${a.goalId}-unassigned`;
    const already = await db.allocations.get(keepId);
    await db.allocations.put({ id: keepId, goalId: a.goalId, accountId: 'unassigned', amountPaise: (already?.amountPaise ?? 0) + a.amountPaise });
  }
  for (const g of goals.filter((x) => x.accountId === id)) await db.goals.put({ ...g, accountId: null });
  await db.accounts.remove(id);
}

