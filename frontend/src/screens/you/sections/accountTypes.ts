import { t } from '../../../lib/i18n';

export type AccountType = 'bank' | 'card' | 'cash' | 'invest' | 'loan';

export const ACCOUNT_TYPES: readonly { id: AccountType; label: string; icon: string }[] = [
  { id: 'bank', get label() { return t('accountsUi.typeBank'); }, icon: 'account_balance' },
  { id: 'card', get label() { return t('accountsUi.typeCard'); }, icon: 'credit_card' },
  { id: 'cash', get label() { return t('accountsUi.typeCash'); }, icon: 'payments' },
  { id: 'invest', get label() { return t('accountsUi.typeInvest'); }, icon: 'trending_up' },
  { id: 'loan', get label() { return t('accountsUi.typeLoan'); }, icon: 'request_quote' },
];

export const BANKS = ['HDFC Bank', 'SBI', 'ICICI Bank', 'Axis Bank', 'Kotak Bank', 'Other'] as const;

/** Day-of-month options such as "1st", "2nd", "18th". */
export const DAYS: readonly string[] = Array.from({ length: 28 }, (_, i) => {
  const n = i + 1;
  const suffix = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
  return `${n}${suffix}`;
});

export const BALANCE_LABEL: Record<AccountType, string> = {
  get bank() { return t('accountsUi.balBank'); },
  get card() { return t('accountsUi.balOwed'); },
  get cash() { return t('accountsUi.balCash'); },
  get invest() { return t('accountsUi.balInvest'); },
  get loan() { return t('accountsUi.balOwed'); },
};
