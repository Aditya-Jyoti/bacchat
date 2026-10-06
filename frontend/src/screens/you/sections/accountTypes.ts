export type AccountType = 'bank' | 'card' | 'cash' | 'invest' | 'loan';

export const ACCOUNT_TYPES: readonly { id: AccountType; label: string; icon: string }[] = [
  { id: 'bank', label: 'Bank', icon: 'account_balance' },
  { id: 'card', label: 'Credit card', icon: 'credit_card' },
  { id: 'cash', label: 'Cash', icon: 'payments' },
  { id: 'invest', label: 'Investment', icon: 'trending_up' },
  { id: 'loan', label: 'Loan', icon: 'request_quote' },
];

export const BANKS = ['HDFC Bank', 'SBI', 'ICICI Bank', 'Axis Bank', 'Kotak Bank', 'Other'] as const;

/** Day-of-month options such as "1st", "2nd", "18th". */
export const DAYS: readonly string[] = Array.from({ length: 28 }, (_, i) => {
  const n = i + 1;
  const suffix = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
  return `${n}${suffix}`;
});

export const BALANCE_LABEL: Record<AccountType, string> = {
  bank: 'Balance',
  card: 'Owed today',
  cash: 'Cash in hand',
  invest: 'Current value',
  loan: 'Owed today',
};
