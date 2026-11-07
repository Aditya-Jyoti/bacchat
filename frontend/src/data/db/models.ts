/**
 * Typed records for the local database. Money is always integer paise.
 * Every record carries id, updatedAt (epoch ms, stamped by the repository) and an optional
 * deletedAt tombstone (used by sync). Mirrors the ER diagram in docs/architecture.md.
 */

export type BaseRecord = {
  id: string;
  updatedAt: number;
  deletedAt?: number | null;
};

/** What callers pass to put(): the repository stamps updatedAt. */
export type NewRecord<T extends BaseRecord> = Omit<T, 'updatedAt'> & { updatedAt?: number };

export type AccountKind = 'bank' | 'cash' | 'mf' | 'nps' | 'card' | 'loan';

export type Account = BaseRecord & {
  name: string;
  kind: AccountKind;
  /** Balance for bank and cash. For mf and nps it is a fallback when no holdings exist. */
  balancePaise: number;
  /**
   * Balance before the first entry. When present, the current balance is derived:
   * openingBalancePaise + the effect of every live entry (see queries/balances.ts). When absent,
   * balancePaise is the opening balance. Never edit balancePaise to follow entries.
   */
  openingBalancePaise?: number | null;
  icon: string;
  /** Last four digits of a debit or credit card, used to match messages. */
  last4?: string | null;
  /** Free text such as "Bank, debit card 4021". */
  note?: string | null;
  /** Investments: when the next payment (SIP, NPS contribution) is due, as YYYY-MM-DD. Shown in Coming up. */
  nextPaymentDate?: string | null;
  /** How the payment above repeats. Absent means every month (a SIP's usual rhythm). */
  paymentRepeat?: Repeat | null;
};

/** Debt side of an account (credit card or loan). Always shown separately, never netted into a balance. */
export type DebtCard = BaseRecord & {
  accountId: string;
  /** Day of month the bill is due, 1..31. */
  dueDay: number;
  outstandingPaise: number;
  /** Dues before the first entry; the current dues are derived like account balances. Absent means outstandingPaise. */
  openingOutstandingPaise?: number | null;
  limitPaise: number;
};

export type EntrySourceKind = 'sms' | 'mail' | 'shot' | 'hand';
export type EntryDirection = 'out' | 'in';
export type EntryStatus = 'confirmed' | 'toReview';
export type PayMethod = 'card' | 'debit' | 'upi' | 'cash' | 'bank';

export type EntrySourceRef = {
  kind: EntrySourceKind;
  /** Opaque reference to the raw message (never synced in clear), e.g. an SMS id. */
  rawRef?: string | null;
};

export type Entry = BaseRecord & {
  /** Always positive. Direction says which way it moved. */
  amountPaise: number;
  direction: EntryDirection;
  /** Epoch ms. */
  at: number;
  merchant: string;
  note?: string | null;
  categoryId: string | null;
  /** Account the money moved through (bank, cash) or the card account. */
  accountId: string | null;
  /** Moved money: the account that receives it. The entry is out of accountId and in to this one, and is not spend. */
  transferToAccountId?: string | null;
  method: PayMethod;
  /** Id of the UpiId record when method is upi. */
  upiId?: string | null;
  sources: EntrySourceRef[];
  status: EntryStatus;
  /** True when an AI or parser added it; shows the To review tag until confirmed. */
  aiAdded: boolean;
  /** Budget this spend is tagged with in k5 (optional). */
  budgetId?: string | null;
};

export type Category = BaseRecord & {
  name: string;
  icon: string;
  /** Hidden from category pickers (k5, k8, k27, k28). Entries that use it keep showing it. */
  hidden?: boolean | null;
  /** A named budget (Food, Fun) this category's spends count toward without tagging each one (k30). */
  budgetId?: string | null;
};

/** What we have learned about a payee: used to infer a category for new entries. */
export type MerchantHistory = BaseRecord & {
  name: string;
  /** Normalised name (see normalizeMerchant). */
  key: string;
  categoryId: string | null;
  count: number;
  totalPaise: number;
  lastAt: number;
};

export type Goal = BaseRecord & {
  name: string;
  icon: string;
  targetPaise: number;
  /** Free text or a date key YYYY-MM-DD. */
  targetDate?: string | null;
  /**
   * The bank or cash account the goal's money is kept in. Setting money aside for the goal adds it
   * to this account's balance (and taking it out takes it off), so net worth sees it through the
   * account. Null: the goal is tracked on its own and is not part of net worth.
   */
  accountId?: string | null;
};

export type GoalAllocation = BaseRecord & {
  goalId: string;
  accountId: string;
  amountPaise: number;
};

/**
 * A monthly budget. Either tied to a category (categoryId, its spends count automatically) or a
 * named budget ("Fun", "Tech": name and icon, categoryId '') that spends are tagged with in k5
 * (Entry.budgetId). A spend tagged with a budget counts there and nowhere else. A category can be
 * linked to a named budget (Category.budgetId): its untagged spends then count there instead.
 */
export type Budget = BaseRecord & {
  categoryId: string;
  monthlyPaise: number;
  /** Named budgets only. */
  name?: string | null;
  icon?: string | null;
};

export type Cadence = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
/** How often a dated item comes round: a cadence, or just the one date. */
export type Repeat = Cadence | 'once';
/** sip, bill and monthly come from the seed; income (pay day) and transfer are events added by hand in k17. */
export type RecurringKind = 'sip' | 'bill' | 'monthly' | 'income' | 'transfer';

export type Recurring = BaseRecord & {
  title: string;
  icon: string;
  /** 0 for an event with no fixed amount (shown without one). */
  amountPaise: number;
  cadence: Repeat;
  /** Next due date as a local date key YYYY-MM-DD. */
  nextDue: string;
  kind: RecurringKind;
  direction: EntryDirection;
  categoryId?: string | null;
  accountId?: string | null;
};

export type UpiId = BaseRecord & {
  handle: string;
  label?: string | null;
  accountId?: string | null;
};

export type FundKind = 'mf' | 'nps';

export type FundHolding = BaseRecord & {
  kind: FundKind;
  accountId?: string | null;
  /** AMFI scheme code, or an NPS scheme id. */
  schemeCode: string;
  name: string;
  /** Units times 1e6. */
  unitsMicro: number;
  /** Last known NAV in rupees times 1e6 (NAV has up to 4 decimals, so paise would lose precision). */
  lastNavMicro: number | null;
  /** Date of the NAV as YYYY-MM-DD. */
  lastNavDate?: string | null;
};

/** Log of overspend alerts already shown; at most one per category per month. */
export type BudgetAlertLog = BaseRecord & {
  categoryId: string;
  /** YYYY-MM */
  month: string;
  firedAt: number;
};

/**
 * Metadata about a screenshot that was read in k7. The image itself is not stored here: uri points
 * at the phone's copy. rowsHash is a hash of the extracted rows so the same screenshot is not
 * counted twice. Image bytes sync only with "Original screenshots" on, as a separate blob.
 */
export type ScreenshotRecord = BaseRecord & {
  /** Where the image lives on this phone (never uploaded as a path). */
  uri: string;
  /** Stable hash of the extracted rows (see screenshotRowsHash). */
  rowsHash: string;
  rowCount: number;
  /** Epoch ms the screenshot was read. */
  readAt: number;
  /** Image size in bytes when known; used for the sync size cap. */
  sizeBytes?: number | null;
  /** Id of the image blob once uploaded ("shot-<id>"). */
  imageBlob?: string | null;
};

/** One Ask Bacchat exchange. Only what the person typed and the reply text; no financial data is stored here. */
export type AskRecord = BaseRecord & {
  question: string;
  answer: string;
  /** Names of the read-only tools the advisor used. */
  toolNames: string[];
  /** Epoch ms. */
  askedAt: number;
  answeredAt: number | null;
};
