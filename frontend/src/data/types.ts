/** Money as integer paise plus the design's exact display text. */
export type Money = { paise: number; text: string };

/** Design colour keys used by sample data, mapped to theme roles by colorKeyToRole. */
export type ColorKey = 'p' | 'k2' | 'k3' | 'k4' | 'onv' | 'ol2';

export type EntrySourceKey = 'sms' | 'mail' | 'shot' | 'hand';

export type NetWorthSample = {
  net: Money;
  own: Money;
  owe: Money;
  delta: Money;
  /** Share widths as in the design, display only. */
  ownW: string;
  oweW: string;
};

export type AllocationItem = { name: string; amount: Money; w: string; color: ColorKey };

export type SpendCategory = {
  name: string;
  icon: string;
  amount: Money;
  color: ColorKey;
  /** Change versus last month. */
  vs: Money;
  up: boolean;
};

export type SpendMethod = { name: string; icon: string; amount: Money; w: string };

export type DayTopEntry = { icon: string; name: string; amount: Money };

export type Merchant = { name: string; icon: string; amount: Money; times: number; timesText: string };

export type EntryItem = {
  name: string;
  icon: string;
  amount: Money;
  category: string;
  via: string;
  time: string;
  source: EntrySourceKey;
  matched?: boolean;
  resolved?: boolean;
  income?: boolean;
};

export type EntryDay = {
  day: string;
  date: string;
  total: Money;
  note?: string;
  items: EntryItem[];
};

export type ScreenshotRowStatus = 'new' | 'match' | 'conflict';

export type ScreenshotRow = {
  name: string;
  icon: string;
  amount: Money;
  time: string;
  status: ScreenshotRowStatus;
  note?: string;
};

export type ConflictOption = { id: 'shot' | 'mail' | 'both'; title: string; subtitle: string };

export type UpcomingItem = {
  date: string;
  month: string;
  name: string;
  icon: string;
  amount: Money;
  kind: 'SIP' | 'Monthly' | 'Card due';
  from: string;
};

export type CashFlowSample = { months: string[]; inRupees: number[]; outRupees: number[] };

export type OwnItem = { name: string; kind: string; icon: string; amount: Money };

export type OweItem = OwnItem & { limit: Money; limitText: string; used: string };

export type UpiItem = {
  id: string;
  bank: string;
  inn: Money;
  out: Money;
  inW: string;
  outW: string;
};

export type GoalSample = {
  name: string;
  icon: string;
  saved: Money;
  target: Money;
  pct: string;
  by: string;
};

export type GoalAllocation = { from: string; icon: string; amount: Money; w: string; color: ColorKey };

export type BudgetItem = {
  name: string;
  icon: string;
  spent: Money;
  limit: Money;
  pct: string;
  over?: boolean;
};

export type HomeSectionId = 'insight' | 'spend' | 'upcoming' | 'goals' | 'budget' | 'accounts';

export type SectionMeta = { label: string; desc: string; icon: string };

export type SearchResult = Omit<EntryItem, 'time'> & { when: string };
