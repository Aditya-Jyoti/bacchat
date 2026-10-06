import { newId, type Account, type BacchatDb } from '../../data/db';
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
  const { kind, icon } = KINDS[input.type];
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
    last4: hasBank ? input.last4 : null,
    note,
  });
  if (isDebt) {
    await db.debts.put({
      id: newId('debt'),
      accountId: id,
      dueDay: input.type === 'card' ? dayOf(input.due) : 1,
      outstandingPaise: input.amountPaise,
      limitPaise: input.type === 'card' ? input.limitPaise : input.amountPaise,
    });
  }
  return id;
}
