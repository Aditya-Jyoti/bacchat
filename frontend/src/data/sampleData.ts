import { groupIndian } from '../lib/format';
import type {
  AllocationItem,
  BudgetItem,
  CashFlowSample,
  ColorKey,
  ConflictOption,
  DayTopEntry,
  EntryDay,
  EntryItem,
  EntrySourceKey,
  GoalAllocation,
  GoalSample,
  HomeSectionId,
  Merchant,
  Money,
  NetWorthSample,
  OweItem,
  OwnItem,
  ScreenshotRow,
  SearchResult,
  SectionMeta,
  SpendCategory,
  SpendMethod,
  UpcomingItem,
  UpiItem,
} from './types';

/** Parse a design display string ("\u20B96,640", "+\u20B9899", "-\u20B9140") into Money. */
export function m(text: string): Money {
  const neg = text.startsWith('-');
  const digits = text.replace(/[^0-9.]/g, '');
  const [r, p = ''] = digits.split('.');
  const paise = parseInt(r || '0', 10) * 100 + (p ? parseInt(p.padEnd(2, '0').slice(0, 2), 10) : 0);
  return { paise: neg ? -paise : paise, text };
}

/** Whole rupees to paise. */
export const rupeesToPaise = (rupees: number): number => rupees * 100;

export const netWorthSeries: readonly number[] = [14.6, 14.9, 14.7, 15.3, 15.6, 15.4, 16.1, 16.5, 16.8, 17.4, 17.98, 18.22]; // lakhs, 12 points

export const netWorth: NetWorthSample = {
  net: m('\u20B918,22,350'),
  own: m('\u20B918,42,350'),
  owe: m('\u20B920,000'),
  delta: m('+\u20B924,180'),
  ownW: '98.9%',
  oweW: '1.1%',
};

export const allocation: AllocationItem[] = [
  { name: 'Mutual funds & SIPs', amount: m('\u20B99,86,400'), w: '53.5%', color: 'p' },
  { name: 'Bank savings', amount: m('\u20B95,31,150'), w: '28.8%', color: 'k2' },
  { name: 'NPS', amount: m('\u20B93,12,800'), w: '17%', color: 'k4' },
  { name: 'Cash', amount: m('\u20B912,000'), w: '0.7%', color: 'onv' },
];

/** Total spend for the month: 31240 rupees. Bar width = v / 6640. */
export const spendTotal: Money = m('\u20B931,240');

export const spend: SpendCategory[] = [
  { name: 'Eating out', icon: 'restaurant', amount: m('\u20B96,640'), color: 'p', vs: m('+\u20B9820'), up: true },
  { name: 'Groceries', icon: 'shopping_basket', amount: m('\u20B96,315'), color: 'k2', vs: m('-\u20B91,120'), up: false },
  { name: 'Shopping', icon: 'checkroom', amount: m('\u20B95,120'), color: 'k3', vs: m('+\u20B9310'), up: true },
  { name: 'Bills', icon: 'bolt', amount: m('\u20B94,890'), color: 'k4', vs: m('-\u20B9140'), up: false },
  { name: 'Transport', icon: 'train', amount: m('\u20B93,260'), color: 'onv', vs: m('-\u20B9460'), up: false },
  { name: 'Everything else', icon: 'more_horiz', amount: m('\u20B95,015'), color: 'ol2', vs: m('-\u20B91,590'), up: false },
];

export const byMethod: SpendMethod[] = [
  { name: 'Credit cards', icon: 'credit_card', amount: m('\u20B912,640'), w: '40%' },
  { name: 'UPI', icon: 'qr_code_2', amount: m('\u20B910,880'), w: '35%' },
  { name: 'Debit card', icon: 'payment', amount: m('\u20B96,520'), w: '21%' },
  { name: 'Cash', icon: 'payments', amount: m('\u20B91,200'), w: '4%' },
];

/** Daily spend for Oct 1..24, in rupees. Average 1302, max 2964. */
export const dailySpendRupees: readonly number[] = [
  980, 1420, 640, 2315, 760, 1180, 520, 1960, 880, 1340, 2240, 610, 990, 1530, 700, 1260, 2890, 830, 1110, 1650,
  940, 2679, 2835, 2964,
];
export const dailySpendPaise: readonly number[] = dailySpendRupees.map(rupeesToPaise);
export const dailyAverage: Money = m('\u20B91,302');
export const dailyDefaultSelectedIndex = 16;
export const dailyTodayIndex = 23;
/** Oct 1 2026 is a Thursday. */
export const dow = ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'] as const;

const pool: readonly (readonly [string, string])[] = [
  ['restaurant', 'Swiggy'],
  ['local_cafe', 'Chai Point'],
  ['train', 'Namma Metro'],
  ['shopping_basket', 'Zepto'],
  ['checkroom', 'Myntra'],
  ['local_taxi', 'Uber'],
  ['movie', 'BookMyShow'],
  ['medication', 'Medplus'],
];

/** Top entries for special days, keyed by day of month as in the design. */
export const dailySpecial: Record<number, DayTopEntry[]> = {
  4: [
    { icon: 'shopping_basket', name: 'BigBasket', amount: m('\u20B92,315') },
    { icon: 'local_cafe', name: 'Chai Point', amount: m('\u20B940') },
  ],
  17: [
    { icon: 'movie', name: 'PVR Cinemas', amount: m('\u20B91,280') },
    { icon: 'restaurant', name: 'Toit (dinner)', amount: m('\u20B91,450') },
  ],
  22: [
    { icon: 'bolt', name: 'BESCOM', amount: m('\u20B91,840') },
    { icon: 'movie', name: 'PVR Cinemas', amount: m('\u20B9640') },
  ],
  23: [
    { icon: 'shopping_basket', name: 'BigBasket', amount: m('\u20B92,315') },
    { icon: 'undo', name: 'Myntra refund', amount: m('+\u20B9899') },
  ],
  24: [
    { icon: 'checkroom', name: 'Amazon', amount: m('\u20B91,249') },
    { icon: 'shopping_basket', name: 'Blinkit', amount: m('\u20B9518') },
  ],
};

export type DayTooltip = {
  dayIndex: number;
  total: Money;
  top: DayTopEntry[];
  entries: number;
  vsAverage: Money;
};

/**
 * Tooltip for a day (index 0..23). Design rule: top = special[d] or
 * [pool[i % 8] at 55% of v, pool[(i*3+2) % 8] at 25% of v]; entry count = 2 + (i*5) % 7 (+3 on day 24);
 * versus the 1302 average.
 */
export function dailyTooltip(i: number): DayTooltip {
  const v = dailySpendRupees[i];
  const day = i + 1;
  const special = dailySpecial[day];
  const mk = (k: number, f: number): DayTopEntry => {
    const [icon, name] = pool[k];
    return { icon, name, amount: m(`\u20B9${groupIndian(String(Math.round(v * f)))}`) };
  };
  const diff = v - 1302;
  return {
    dayIndex: i,
    total: m(`\u20B9${groupIndian(String(v))}`),
    top: special ?? [mk(i % 8, 0.55), mk((i * 3 + 2) % 8, 0.25)],
    entries: 2 + ((i * 5) % 7) + (day === 24 ? 3 : 0),
    vsAverage: m(`${diff < 0 ? '-' : '+'}\u20B9${groupIndian(String(Math.abs(diff)))}`),
  };
}

export const merchants: Merchant[] = [
  { name: 'Swiggy', icon: 'restaurant', amount: m('\u20B93,820'), times: 9, timesText: '9 times' },
  { name: 'BigBasket', icon: 'shopping_basket', amount: m('\u20B94,630'), times: 2, timesText: '2 times' },
  { name: 'Amazon', icon: 'checkroom', amount: m('\u20B93,410'), times: 3, timesText: '3 times' },
  { name: 'Namma Metro', icon: 'train', amount: m('\u20B92,060'), times: 5, timesText: '5 times' },
];

export const sourceName: Record<EntrySourceKey, string> = {
  sms: 'SMS',
  mail: 'Email',
  shot: 'Screenshot',
  hand: 'Added by you',
};
export const sourceIcon: Record<EntrySourceKey, string> = {
  sms: 'sms',
  mail: 'mail',
  shot: 'screenshot_region',
  hand: 'edit',
};

type Extra = { resolved?: boolean; matched?: boolean; inc?: boolean };
function item(
  name: string,
  icon: string,
  amt: string,
  category: string,
  via: string,
  time: string,
  source: EntrySourceKey,
  extra: Extra = {},
): EntryItem {
  return {
    name,
    icon,
    amount: m(amt),
    category,
    via,
    time,
    source,
    ...(extra.resolved ? { resolved: true } : {}),
    ...(extra.matched ? { matched: true } : {}),
    ...(extra.inc ? { income: true } : {}),
  };
}

export const entryDays: EntryDay[] = [
  {
    day: 'Today',
    date: 'Sat, 24 Oct',
    total: m('\u20B93,334'),
    note: '10 entries \u00B7 2 from SMS/email, 8 from your screenshot',
    items: [
      item('Blinkit', 'shopping_basket', '\u20B9518', 'Groceries', 'UPI \u00B7 rahul@okhdfc', '8:40 pm', 'shot'),
      item('Medplus', 'medication', '\u20B9342', 'Medicines', 'UPI \u00B7 rahul@okhdfc', '7:55 pm', 'shot'),
      item('Third Wave Coffee', 'local_cafe', '\u20B9280', 'Tea & coffee', 'UPI \u00B7 rahul@okhdfc', '5:30 pm', 'shot'),
      item('Amazon', 'checkroom', '\u20B91,249', 'Shopping', 'ICICI credit card', '3:12 pm', 'mail', { resolved: true }),
      item('Swiggy', 'restaurant', '\u20B9486', 'Eating out', 'ICICI credit card', '1:42 pm', 'sms', { matched: true }),
      item('Ramesh Fruits', 'nutrition', '\u20B9150', 'Fruit & veg', 'UPI \u00B7 rahul.s@ybl', '12:10 pm', 'shot'),
      item('Rapido', 'two_wheeler', '\u20B989', 'Bike taxi', 'UPI \u00B7 rahul.s@ybl', '11:02 am', 'shot'),
    ],
  },
  {
    day: 'Yesterday',
    date: 'Fri, 23 Oct',
    total: m('\u20B92,835'),
    items: [
      item('BigBasket', 'shopping_basket', '\u20B92,315', 'Groceries', 'HDFC debit card', '8:30 pm', 'sms'),
      item('Myntra refund', 'undo', '+\u20B9899', 'Refund', 'HDFC Savings', '11:00 am', 'mail', { inc: true }),
      item('Auto ride', 'electric_rickshaw', '\u20B9120', 'Transport', 'Cash', '10:20 am', 'hand'),
    ],
  },
];

function shotRow(
  name: string,
  icon: string,
  amt: string,
  time: string,
  status: ScreenshotRow['status'],
  note?: string,
): ScreenshotRow {
  return { name, icon, amount: m(amt), time, status, ...(note ? { note } : {}) };
}

export const screenshotRows: ScreenshotRow[] = [
  shotRow('Chai Point', 'local_cafe', '\u20B940', '9:05 am', 'new'),
  shotRow('Namma Metro', 'train', '\u20B960', '9:20 am', 'new'),
  shotRow('Rapido', 'two_wheeler', '\u20B989', '11:02 am', 'new'),
  shotRow('Ramesh Fruits', 'nutrition', '\u20B9150', '12:10 pm', 'new', 'guess: Fruit & veg - guessed'),
  shotRow('Swiggy', 'restaurant', '\u20B9486', '1:42 pm', 'match', 'Same as the SMS entry \u00B7 skipped'),
  shotRow('Amazon', 'checkroom', '\u20B91,249', '3:12 pm', 'conflict', 'Email says \u20B91,299 \u00B7 pick one'),
  shotRow('Third Wave Coffee', 'local_cafe', '\u20B9280', '5:30 pm', 'new'),
  shotRow('Medplus', 'medication', '\u20B9342', '7:55 pm', 'new'),
  shotRow('Blinkit', 'shopping_basket', '\u20B9518', '8:40 pm', 'new'),
  shotRow('Mohan S', 'help', '\u20B9500', '9:15 pm', 'new', 'unsure: Who is this? Pick a category'),
];

export const conflictOptions: ConflictOption[] = [
  { id: 'shot', title: 'Keep \u20B91,249 from screenshot', subtitle: 'Probably a coupon or cashback after the email' },
  { id: 'mail', title: 'Keep \u20B91,299 from email', subtitle: 'The order confirmation amount' },
  { id: 'both', title: 'They are two different payments', subtitle: 'Keep both as separate entries' },
];

export const upcoming: UpcomingItem[] = [
  { date: '25', month: 'Oct', name: 'Axis Bluechip SIP', icon: 'trending_up', amount: m('\u20B93,000'), kind: 'SIP', from: 'SBI Salary' },
  { date: '28', month: 'Oct', name: 'Netflix', icon: 'live_tv', amount: m('\u20B9199'), kind: 'Monthly', from: 'ICICI card' },
  { date: '31', month: 'Oct', name: 'ICICI card bill', icon: 'credit_card', amount: m('\u20B914,820'), kind: 'Card due', from: 'HDFC Savings' },
  { date: '1', month: 'Nov', name: 'Rent', icon: 'home', amount: m('\u20B922,000'), kind: 'Monthly', from: 'HDFC Savings' },
  { date: '5', month: 'Nov', name: 'HDFC Millennia bill', icon: 'credit_card', amount: m('\u20B95,180'), kind: 'Card due', from: 'HDFC Savings' },
  { date: '5', month: 'Nov', name: 'Parag Parikh Flexi Cap SIP', icon: 'trending_up', amount: m('\u20B95,000'), kind: 'SIP', from: 'SBI Salary' },
];

/**
 * Calendar strip: 28 days, first 14 = Oct 18..31, next 14 = Nov 1..14; index 6 (Oct 24) is today.
 * Dots: Oct 25 sip (chart2), Oct 28 bill (primary), Oct 31 bill, Nov 1 bill, Nov 5 sip, Nov 10 sip.
 */
export const calendarStrip = {
  todayIndex: 6,
  dots: [
    { index: 7, kind: 'sip' },
    { index: 10, kind: 'bill' },
    { index: 13, kind: 'bill' },
    { index: 14, kind: 'bill' },
    { index: 18, kind: 'sip' },
    { index: 23, kind: 'sip' },
  ] as readonly { index: number; kind: 'sip' | 'bill' }[],
};

/** Cash flow in thousands of rupees (design heights = v / 126). */
export const cashFlow: CashFlowSample = {
  months: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
  inRupees: [112, 112, 118, 112, 112, 126],
  outRupees: [84, 91, 79, 102, 88, 74],
};

export const own: OwnItem[] = [
  { name: 'HDFC Savings', kind: 'Bank \u00B7 debit card \u2022\u20224021', icon: 'account_balance', amount: m('\u20B93,12,400') },
  { name: 'SBI Salary', kind: 'Bank', icon: 'account_balance', amount: m('\u20B92,18,750') },
  { name: 'Cash wallet', kind: 'Cash', icon: 'payments', amount: m('\u20B912,000') },
  { name: 'Mutual funds', kind: '6 funds \u00B7 live NAV', icon: 'trending_up', amount: m('\u20B99,86,400') },
  { name: 'NPS Tier I', kind: 'Live NAV', icon: 'elderly', amount: m('\u20B93,12,800') },
];

export const owe: OweItem[] = [
  { name: 'ICICI Amazon Pay', kind: 'Credit card \u00B7 due 31 Oct', icon: 'credit_card', amount: m('\u20B914,820'), limit: m('\u20B92,00,000'), limitText: '\u20B92,00,000 limit', used: '7%' },
  { name: 'HDFC Millennia', kind: 'Credit card \u00B7 due 5 Nov', icon: 'credit_card', amount: m('\u20B95,180'), limit: m('\u20B91,00,000'), limitText: '\u20B91,00,000 limit', used: '5%' },
];

export const upi: UpiItem[] = [
  { id: 'rahul@okhdfc', bank: 'HDFC Savings', inn: m('\u20B942,300'), out: m('\u20B928,140'), inW: '100%', outW: '66%' },
  { id: 'rahul.s@ybl', bank: 'SBI Salary', inn: m('\u20B95,000'), out: m('\u20B911,920'), inW: '12%', outW: '28%' },
];

export const goals: GoalSample[] = [
  { name: 'Goa with friends', icon: 'beach_access', saved: m('\u20B938,000'), target: m('\u20B960,000'), pct: '63%', by: 'by 20 Dec' },
  { name: 'Emergency fund', icon: 'health_and_safety', saved: m('\u20B92,40,000'), target: m('\u20B93,00,000'), pct: '80%', by: '6 months of expenses' },
  { name: 'Diwali gifts', icon: 'redeem', saved: m('\u20B99,000'), target: m('\u20B912,000'), pct: '75%', by: 'by 8 Nov' },
  { name: 'New laptop', icon: 'laptop_mac', saved: m('\u20B922,500'), target: m('\u20B990,000'), pct: '25%', by: 'by June' },
];

/** Allocation toward the Goa goal. */
export const goalAllocation: GoalAllocation[] = [
  { from: 'HDFC Savings', icon: 'account_balance', amount: m('\u20B925,000'), w: '66%', color: 'p' },
  { from: 'SBI Salary', icon: 'account_balance', amount: m('\u20B910,000'), w: '26%', color: 'k2' },
  { from: 'Cash wallet', icon: 'payments', amount: m('\u20B93,000'), w: '8%', color: 'k3' },
];

/** Total 45000, spent 31240, left 13760, 7 days left (about 1,965 a day). Eating out is over: caution colours. */
export const budgetSummary = {
  total: m('\u20B945,000'),
  spent: m('\u20B931,240'),
  left: m('\u20B913,760'),
  daysLeft: 7,
  perDay: m('\u20B91,965'),
};

export const budgets: BudgetItem[] = [
  { name: 'Eating out', icon: 'restaurant', spent: m('\u20B96,640'), limit: m('\u20B96,000'), pct: '100%', over: true },
  { name: 'Shopping', icon: 'checkroom', spent: m('\u20B95,120'), limit: m('\u20B96,000'), pct: '85%' },
  { name: 'Groceries', icon: 'shopping_basket', spent: m('\u20B96,315'), limit: m('\u20B98,000'), pct: '79%' },
  { name: 'Bills', icon: 'bolt', spent: m('\u20B94,890'), limit: m('\u20B96,000'), pct: '82%' },
  { name: 'Transport', icon: 'train', spent: m('\u20B93,260'), limit: m('\u20B94,000'), pct: '82%' },
];

export const categoryIcons: readonly (readonly [string, string])[] = [
  ['local_cafe', 'Tea & coffee'],
  ['restaurant', 'Eating out'],
  ['shopping_basket', 'Groceries'],
  ['nutrition', 'Fruit & veg'],
  ['train', 'Metro'],
  ['electric_rickshaw', 'Auto'],
  ['two_wheeler', 'Bike taxi'],
  ['bolt', 'Electricity'],
  ['checkroom', 'Clothes'],
  ['medication', 'Medicines'],
  ['movie', 'Movies'],
  ['redeem', 'Gifts'],
];

export const sectionMeta: Record<HomeSectionId, SectionMeta> = {
  insight: { label: 'Bacchat noticed', desc: 'Small tips from your own data', icon: 'auto_awesome' },
  spend: { label: 'This month', desc: 'Spend by category', icon: 'donut_small' },
  upcoming: { label: 'Coming up', desc: 'Bills, card dues and SIPs', icon: 'event_upcoming' },
  goals: { label: 'Goals', desc: 'Progress on what you are saving for', icon: 'flag' },
  budget: { label: 'Budget', desc: 'How this month is pacing', icon: 'account_balance_wallet' },
  accounts: { label: 'Own & owe', desc: 'What is yours vs. what is due', icon: 'account_balance' },
};

export const keypadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'] as const;

export const recentSearches: readonly string[] = ['swiggy', 'rent october', 'over \u20B92,000'];

function sr(name: string, icon: string, amt: string, category: string, via: string, when: string, source: EntrySourceKey): SearchResult {
  return { name, icon, amount: m(amt), category, via, when, source };
}

export const searchResults: SearchResult[] = [
  sr('Swiggy', 'restaurant', '\u20B9486', 'Eating out', 'ICICI credit card', 'Today', 'sms'),
  sr('Swiggy', 'restaurant', '\u20B9612', 'Eating out', 'ICICI credit card', '21 Oct', 'sms'),
  sr('Swiggy Instamart', 'shopping_basket', '\u20B91,140', 'Groceries', 'UPI \u00B7 rahul@okhdfc', '18 Oct', 'shot'),
  sr('Swiggy', 'restaurant', '\u20B9389', 'Eating out', 'HDFC debit card', '14 Oct', 'hand'),
];

/** Maps design colour keys to theme role names. */
export const colorKeyToRole: Record<ColorKey, 'primary' | 'chart2' | 'chart3' | 'chart4' | 'onSurfaceVariant' | 'outline'> = {
  p: 'primary',
  k2: 'chart2',
  k3: 'chart3',
  k4: 'chart4',
  onv: 'onSurfaceVariant',
  ol2: 'outline',
};
