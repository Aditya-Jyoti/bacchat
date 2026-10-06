/**
 * Seed the database from the design's sample data so a fresh install can show the design's
 * numbers. Net worth, own and owe match the sample exactly. Entries are placed in October 2026
 * ("today" is Sat 24 Oct). October spend per category, the "vs last month" deltas, the spend by
 * method, the UPI ids, cash flow (May to Sep) and the profile counts follow the sample; see
 * docs/decisions.md for the figures the sample cannot satisfy together.
 */
import { indiaCategoryIcons } from '../categoryIconCatalog';
import * as S from '../sampleData';
import type { EntryItem } from '../types';
import type { BacchatDb } from './repositories';
import type { Account, Category, Entry, EntrySourceKind, PayMethod, Recurring } from './models';
import { holdingValuePaise } from '../../lib/nav/valuation';
import { rebaseOpeningBalances } from './queries/balances';
import { buildHistory, merchantFor, type EntryDraft } from './seedHistory';

export const SAMPLE_TODAY = new Date(2026, 9, 24, 21, 30).getTime();
export const SEED_FLAG = 'seeded.sample.v1';

export const slug = (name: string): string =>
  name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function parseClock(text: string): { h: number; min: number } {
  const m = /^(\d{1,2}):(\d{2}) (am|pm)$/.exec(text);
  if (!m) throw new Error(`Bad time: ${text}`);
  let h = parseInt(m[1], 10) % 12;
  if (m[3] === 'pm') h += 12;
  return { h, min: parseInt(m[2], 10) };
}

const at = (month: number, day: number, h = 12, min = 0): number => new Date(2026, month, day, h, min).getTime();

type FundSeed = { code: string; name: string; units: number; nav: number; kind: 'mf' | 'nps' };
/** Units x NAV are exact rupee amounts that add up to the sample's totals. */
const FUNDS: FundSeed[] = [
  { code: '120465', name: 'Axis Bluechip Fund Direct Growth', units: 4000, nav: 62.5, kind: 'mf' },
  { code: '122639', name: 'Parag Parikh Flexi Cap Fund Direct Growth', units: 2500, nav: 80, kind: 'mf' },
  { code: '118989', name: 'HDFC Mid-Cap Opportunities Fund Direct Growth', units: 1200, nav: 150, kind: 'mf' },
  { code: '125497', name: 'SBI Small Cap Fund Direct Growth', units: 3000, nav: 50, kind: 'mf' },
  { code: '120716', name: 'UTI Nifty 50 Index Fund Direct Growth', units: 800, nav: 133, kind: 'mf' },
  { code: '118834', name: 'Mirae Asset Large Cap Fund Direct Growth', units: 2000, nav: 50, kind: 'mf' },
  { code: 'SM001003', name: 'SBI Pension Fund Scheme C Tier I', units: 10000, nav: 31.28, kind: 'nps' },
];

/** The design's summary rows are six: every other category folds into one of them in the seed. */
const SIX_CAT: Record<string, string> = {
  'tea-and-coffee': 'eating-out',
  'fruit-and-veg': 'groceries',
  'bike-taxi': 'transport',
  medicines: 'everything-else',
  entertainment: 'everything-else',
};
/**
 * UPI spend this month. The sample's UPI row of "By method" is Rs 10,880, which is all the UPI spend
 * that fits inside the month's Rs 31,240, so the per-id outflows cannot reach the design's 28,140 and
 * 11,920 (they add up to more than the whole month). They are sized to that row instead.
 */
const UPI_OUT_RUPEES = { okhdfc: 7360, ybl: 2920, paytm: 600 };
/** October money in, from the design's cash flow chart (126 thousand). */
const OCT_IN_RUPEES = S.cashFlow.inRupees[5] * 1000;
/** Profile numbers from the design: 1,284 entries over 8 months (March to October). */
const PROFILE_ENTRIES = 1284;

function methodVia(key: string, k: number): { method: PayMethod; accountId: string; upiId: string | null } {
  if (key === 'card') return { method: 'card', accountId: k % 2 ? 'acc-hdfc-card' : 'acc-icici', upiId: null };
  if (key === 'cash') return { method: 'cash', accountId: 'acc-cash', upiId: null };
  if (key === 'debit') return { method: 'debit', accountId: 'acc-hdfc', upiId: null };
  if (key === 'upi:ybl') return { method: 'upi', accountId: 'acc-sbi', upiId: 'upi-ybl' };
  return { method: 'upi', accountId: 'acc-hdfc', upiId: key === 'upi:paytm' ? 'upi-paytm' : 'upi-okhdfc' };
}
const micro = (n: number): number => Math.round(n * 1_000_000);

export async function seedFromSampleData(db: BacchatDb): Promise<void> {
  // Categories: every name used anywhere in the sample.
  const catIcons = new Map<string, string>();
  const addCat = (name: string, icon: string): void => {
    if (!catIcons.has(slug(name))) catIcons.set(slug(name), icon);
  };
  S.spend.forEach((c) => addCat(c.name, c.icon));
  S.budgets.forEach((b) => addCat(b.name, b.icon));
  S.categoryIcons.forEach(([icon, name]) => addCat(name, icon));
  // India-specific categories use the custom icons; they stay unused until tagged.
  indiaCategoryIcons.forEach(([icon, name]) => addCat(name, icon));
  S.entryDays.forEach((d) => d.items.forEach((i) => addCat(i.category, i.icon)));
  addCat('Entertainment', 'movie');
  addCat('Income', 'payments');
  addCat('Rent', 'home');
  addCat('Investments', 'trending_up');
  addCat('Transfers', 'credit_card');
  const nameOf = new Map<string, string>();
  S.spend.forEach((c) => nameOf.set(slug(c.name), c.name));
  S.budgets.forEach((b) => nameOf.set(slug(b.name), b.name));
  S.categoryIcons.forEach(([, n]) => nameOf.set(slug(n), n));
  indiaCategoryIcons.forEach(([, n]) => nameOf.set(slug(n), n));
  S.entryDays.forEach((d) => d.items.forEach((i) => nameOf.set(slug(i.category), i.category)));
  nameOf.set('entertainment', 'Entertainment');
  nameOf.set('income', 'Income');
  nameOf.set('rent', 'Rent');
  nameOf.set('investments', 'Investments');
  nameOf.set('transfers', 'Transfers');
  const cats: Omit<Category, 'updatedAt'>[] = [...catIcons.entries()].map(([id, icon]) => ({
    id,
    name: nameOf.get(id) ?? id,
    icon,
  }));
  await db.categories.putMany(cats);

  // Accounts and debts.
  const acct = (id: string, name: string, kind: Account['kind'], balancePaise: number, icon: string, last4?: string): Omit<Account, 'updatedAt'> => ({
    id,
    name,
    kind,
    balancePaise,
    icon,
    last4: last4 ?? null,
  });
  const own = Object.fromEntries(S.own.map((o) => [o.name, o]));
  await db.accounts.putMany([
    acct('acc-hdfc', 'HDFC Savings', 'bank', own['HDFC Savings'].amount.paise, 'account_balance', '4021'),
    acct('acc-sbi', 'SBI Salary', 'bank', own['SBI Salary'].amount.paise, 'account_balance'),
    acct('acc-cash', 'Cash wallet', 'cash', own['Cash wallet'].amount.paise, 'payments'),
    acct('acc-mf', 'Mutual funds', 'mf', own['Mutual funds'].amount.paise, 'trending_up'),
    acct('acc-nps', 'NPS Tier I', 'nps', own['NPS Tier I'].amount.paise, 'elderly'),
    acct('acc-icici', 'ICICI Amazon Pay', 'card', 0, 'credit_card'),
    acct('acc-hdfc-card', 'HDFC Millennia', 'card', 0, 'credit_card'),
  ]);
  const dueDay: Record<string, number> = { 'ICICI Amazon Pay': 31, 'HDFC Millennia': 5 };
  await db.debts.putMany(
    S.owe.map((o) => ({
      id: o.name === 'ICICI Amazon Pay' ? 'debt-icici' : 'debt-hdfc-card',
      accountId: o.name === 'ICICI Amazon Pay' ? 'acc-icici' : 'acc-hdfc-card',
      dueDay: dueDay[o.name],
      outstandingPaise: o.amount.paise,
      limitPaise: o.limit.paise,
    })),
  );

  await db.holdings.putMany(
    FUNDS.map((f) => ({
      id: `hold-${f.code}`,
      kind: f.kind,
      accountId: f.kind === 'mf' ? 'acc-mf' : 'acc-nps',
      schemeCode: f.code,
      name: f.name,
      unitsMicro: micro(f.units),
      lastNavMicro: micro(f.nav),
      lastNavDate: '2026-10-23',
    })),
  );

  await db.upiIds.putMany([
    ...S.upi.map((u) => ({
      id: u.id === 'rahul@okhdfc' ? 'upi-okhdfc' : 'upi-ybl',
      handle: u.id,
      label: u.bank,
      accountId: u.bank === 'HDFC Savings' ? 'acc-hdfc' : 'acc-sbi',
    })),
    { id: 'upi-paytm', handle: 'rahul.k@paytm', label: 'HDFC Savings', accountId: 'acc-hdfc' },
  ]);
  const upiIdOf = (handle: string): string => (handle === 'rahul@okhdfc' ? 'upi-okhdfc' : 'upi-ybl');

  // Entries from the sample list.
  const entries: Omit<Entry, 'updatedAt'>[] = [];
  let n = 0;
  const push = (e: EntryDraft): void => {
    n += 1;
    entries.push({ id: `seed-e${String(n).padStart(3, '0')}`, ...e });
  };
  const dayMonth = [{ d: 24 }, { d: 23 }];
  /** Everything the design lists maps onto the six spend rows of the summary. */
  const sixCat = (id: string): string => SIX_CAT[id] ?? id;
  const fixedByCat: Record<string, number> = {};
  const quota: Record<string, number> = {
    card: S.byMethod[0].amount.paise / 100,
    'upi:okhdfc': UPI_OUT_RUPEES.okhdfc,
    'upi:ybl': UPI_OUT_RUPEES.ybl,
    'upi:paytm': UPI_OUT_RUPEES.paytm,
    debit: S.byMethod[2].amount.paise / 100,
    cash: S.byMethod[3].amount.paise / 100,
  };
  S.entryDays.forEach((day, di) => {
    for (const it of day.items) {
      const { h, min } = parseClock(it.time);
      const { method, accountId, upiId } = viaToMethod(it, upiIdOf);
      const sources: EntrySourceKind[] = [it.source];
      if (it.matched) sources.push('shot');
      if (it.resolved) sources.push('shot');
      const pending = (it.source === 'sms' || it.source === 'mail') && !it.matched && !it.resolved;
      const categoryId = it.income ? slug(it.category) : sixCat(slug(it.category));
      if (!it.income) {
        const rupees = Math.abs(it.amount.paise) / 100;
        fixedByCat[categoryId] = (fixedByCat[categoryId] ?? 0) + rupees;
        const key = method === 'upi' ? `upi:${upiId === 'upi-okhdfc' ? 'okhdfc' : 'ybl'}` : method === 'bank' ? 'debit' : method;
        quota[key] -= rupees;
      }
      push({
        amountPaise: Math.abs(it.amount.paise),
        direction: it.income ? 'in' : 'out',
        at: at(9, dayMonth[di].d, h, min),
        merchant: it.name,
        note: null,
        categoryId,
        accountId,
        method,
        upiId,
        sources: sources.map((kind, i) => (it.resolved && i === 1 ? { kind, rawRef: 'resolved' } : { kind })),
        status: pending ? 'toReview' : 'confirmed',
        aiAdded: pending,
      });
    }
  });

  // Earlier days of October. Days with listed top entries keep them; every other day is a slot whose
  // total is spread over the six categories so the month's category totals match the sample.
  type Piece = { rupees: number; cat: string; merchant: string; day: number };
  const special: Piece[] = [];
  const slots: { day: number; rupees: number }[] = [];
  S.dailySpendRupees.slice(0, 22).forEach((rupees, i) => {
    const day = i + 1;
    const top = S.dailySpecial[day];
    if (!top) {
      slots.push({ day, rupees });
      return;
    }
    let rest = rupees;
    for (const t of top) {
      // The design's top entries can add up to more than the day's total; cap at what is left.
      const amt = Math.min(t.amount.paise / 100, rest);
      if (amt <= 0) continue;
      const cat = sixCat(specialCat(t.name));
      special.push({ rupees: amt, cat, merchant: t.name, day });
      fixedByCat[cat] = (fixedByCat[cat] ?? 0) + amt;
      rest -= amt;
    }
    if (rest > 0) slots.push({ day, rupees: rest });
  });
  // The sample's daily series adds up to more than its own month total, so the ordinary days are
  // scaled down together; days with listed entries and the Today and Yesterday lists stay as designed.
  const need: Record<string, number> = {};
  for (const c of S.spend) need[slug(c.name)] = c.amount.paise / 100 - (fixedByCat[slug(c.name)] ?? 0);
  const flexTotal = Object.values(need).reduce((a, b) => a + b, 0);
  const specialDays = new Set(special.map((p) => p.day));
  const ordinary = slots.filter((x) => !specialDays.has(x.day));
  const keep = slots.filter((x) => specialDays.has(x.day)).reduce((a, x) => a + x.rupees, 0);
  const ordinaryTotal = ordinary.reduce((a, x) => a + x.rupees, 0);
  const scale = (flexTotal - keep) / ordinaryTotal;
  let given = 0;
  ordinary.forEach((x, i) => {
    x.rupees = i === ordinary.length - 1 ? flexTotal - keep - given : Math.max(50, Math.round((x.rupees * scale) / 10) * 10);
    given += x.rupees;
  });
  const pieces: Piece[] = [...special];
  const order = S.spend.map((c) => slug(c.name));
  slots.forEach((slot, si) => {
    const left = order.reduce((a, k) => a + need[k], 0);
    const parts: Record<string, number> = {};
    if (si === slots.length - 1) {
      if (slot.rupees !== left) throw new Error('Seed: last day does not close the month');
      order.forEach((k) => (parts[k] = need[k]));
    } else {
      let given2 = 0;
      if (slot.rupees > left) throw new Error('Seed: day total exceeds what is left to place');
      order.forEach((k) => {
        parts[k] = Math.min(need[k], Math.round((slot.rupees * need[k]) / left));
        given2 += parts[k];
      });
      // Rounding difference goes to the category with the most still to place.
      let diff = slot.rupees - given2;
      const byRoom = [...order].sort((a, b) => need[b] - parts[b] - (need[a] - parts[a]));
      for (const k of byRoom) {
        const add = Math.max(-parts[k], Math.min(diff, need[k] - parts[k]));
        parts[k] += add;
        diff -= add;
      }
      // Fold crumbs into the day's biggest piece while there is plenty of room left.
      if (slot.rupees / left < 0.5) {
        const big = [...order].sort((a, b) => parts[b] - parts[a])[0];
        for (const k of order) {
          if (k !== big && parts[k] > 0 && parts[k] < 200 && parts[big] + parts[k] <= need[big]) {
            parts[big] += parts[k];
            parts[k] = 0;
          }
        }
      }
    }
    for (const k of order) {
      if (parts[k] <= 0) continue;
      need[k] -= parts[k];
      pieces.push({ rupees: parts[k], cat: k, merchant: merchantFor(k, slot.day + si), day: slot.day });
    }
  });
  pieces.sort((a, b) => a.day - b.day);

  // Spend by method: split pieces over cards, UPI ids, debit and cash until each quota is used.
  const cycle = ['card', 'upi:okhdfc', 'debit', 'upi:ybl', 'upi:paytm', 'cash'];
  let ptr = 0;
  const hourOf: Record<number, number> = {};
  pieces.forEach((p, pi) => {
    let remaining = p.rupees;
    while (remaining > 0) {
      const order2 = cycle.map((_, k) => cycle[(ptr + k) % cycle.length]).filter((k) => quota[k] > 0);
      const key = order2.find((k) => quota[k] >= remaining) ?? order2[0];
      if (!key) throw new Error('Seed: method quotas ran out');
      const take = Math.min(remaining, quota[key]);
      quota[key] -= take;
      remaining -= take;
      ptr += 1;
      hourOf[p.day] = ((hourOf[p.day] ?? 6) + 2) % 16 + 6;
      const via = methodVia(key, pi);
      push({
        ...base(),
        amountPaise: take * 100,
        at: at(9, p.day, hourOf[p.day], (pi * 7) % 60),
        merchant: p.merchant,
        categoryId: p.cat,
        accountId: via.accountId,
        method: via.method,
        upiId: via.upiId,
        sources: [{ kind: via.method === 'cash' ? 'hand' : 'sms' }],
      });
    }
  });
  if (Object.values(quota).some((v) => v !== 0)) throw new Error('Seed: method quotas not used up');
  Object.values(need).forEach((v) => {
    if (v !== 0) throw new Error('Seed: category totals not placed');
  });

  // October money in: 1,26,000 in all, with the UPI credits of the sample.
  const inc = (rupees: number, day: number, h: number, merchant: string, extra: Partial<EntryDraft>): void =>
    push({ ...base(), amountPaise: rupees * 100, direction: 'in', at: at(9, day, h), merchant, categoryId: 'income', accountId: 'acc-sbi', method: 'bank', ...extra });
  inc(70000, 1, 9, 'Salary', {});
  inc(S.upi[0].inn.paise / 100, 9, 11, 'Client payment', { accountId: 'acc-hdfc', method: 'upi', upiId: 'upi-okhdfc' });
  inc(S.upi[1].inn.paise / 100, 12, 20, 'Roommate share', { method: 'upi', upiId: 'upi-ybl' });
  inc(1200, 14, 18, 'Friend paid back', { accountId: 'acc-hdfc', method: 'upi', upiId: 'upi-paytm' });
  inc(OCT_IN_RUPEES - 70000 - S.upi[0].inn.paise / 100 - S.upi[1].inn.paise / 100 - 1200 - 899, 15, 12, 'Freelance invoice', { accountId: 'acc-hdfc' });

  // September and earlier. September per category is last month's figure from the sample.
  const sept: Record<string, number> = {};
  for (const c of S.spend) sept[slug(c.name)] = (c.amount.paise - c.vs.paise) / 100;
  const octCount = n;
  buildHistory(sept, PROFILE_ENTRIES - octCount).forEach(push);

  await db.entries.putMany(entries);
  for (const e of [...entries].sort((a, b) => a.at - b.at)) {
    if (e.direction === 'out' && e.at >= at(9, 1, 0) && e.categoryId !== 'income') {
      await db.merchants.record(e.merchant, e.categoryId, e.amountPaise, e.at);
    }
  }

  await db.budgets.putMany(
    S.budgets.map((b) => ({ id: `bud-${slug(b.name)}`, categoryId: slug(b.name), monthlyPaise: b.limit.paise })),
  );

  const goalIds = Object.fromEntries(S.goals.map((g) => [g.name, `goal-${slug(g.name)}`]));
  await db.goals.putMany([
    ...S.goals.map((g) => ({
      id: goalIds[g.name],
      name: g.name,
      icon: g.icon,
      targetPaise: g.target.paise,
      targetDate: g.by,
    })),
    { id: 'goal-new-phone', name: 'New phone', icon: 'smartphone', targetPaise: 24000 * 100, targetDate: 'done in March' },
    { id: 'goal-jaipur', name: 'Jaipur weekend', icon: 'flight', targetPaise: 18000 * 100, targetDate: 'done in July' },
  ]);
  const accOf: Record<string, string> = { 'HDFC Savings': 'acc-hdfc', 'SBI Salary': 'acc-sbi', 'Cash wallet': 'acc-cash' };
  // Nothing is set aside beyond what an account holds. Emergency fund sits in two banks, and Diwali
  // gifts in SBI, which has the most room, so "SBI can cover it today" is true.
  const emergency = S.goals[1].saved.paise;
  const emergencySbi = 150000 * 100;
  await db.allocations.putMany([
    ...S.goalAllocation.map((a) => ({ id: `alloc-goa-${accOf[a.from]}`, goalId: goalIds['Goa with friends'], accountId: accOf[a.from], amountPaise: a.amount.paise })),
    { id: 'alloc-emergency', goalId: goalIds['Emergency fund'], accountId: 'acc-sbi', amountPaise: emergencySbi },
    { id: 'alloc-emergency-hdfc', goalId: goalIds['Emergency fund'], accountId: 'acc-hdfc', amountPaise: emergency - emergencySbi },
    { id: 'alloc-diwali', goalId: goalIds['Diwali gifts'], accountId: 'acc-sbi', amountPaise: S.goals[2].saved.paise },
    { id: 'alloc-laptop', goalId: goalIds['New laptop'], accountId: 'acc-hdfc', amountPaise: S.goals[3].saved.paise },
    { id: 'alloc-phone', goalId: 'goal-new-phone', accountId: 'acc-hdfc', amountPaise: 24000 * 100 },
    { id: 'alloc-jaipur', goalId: 'goal-jaipur', accountId: 'acc-hdfc', amountPaise: 18000 * 100 },
  ]);

  const nextDue: Record<string, string> = {
    'Axis Bluechip SIP': '2026-10-25',
    Netflix: '2026-10-28',
    Rent: '2026-11-01',
    'Parag Parikh Flexi Cap SIP': '2026-11-05',
  };
  await db.recurring.putMany(
    S.upcoming
      .filter((u) => u.kind !== 'Card due')
      .map((u) => ({
        id: `rec-${slug(u.name)}`,
        title: u.name,
        icon: u.icon,
        amountPaise: u.amount.paise,
        cadence: 'monthly' as const,
        nextDue: nextDue[u.name],
        kind: u.kind === 'SIP' ? ('sip' as const) : ('monthly' as const),
        direction: 'out' as const,
        categoryId: u.name === 'Rent' ? 'bills' : null,
        accountId: u.from === 'SBI Salary' ? 'acc-sbi' : u.from === 'HDFC Savings' ? 'acc-hdfc' : 'acc-icici',
      })),
  );
  const more = (
    id: string,
    title: string,
    icon: string,
    rupees: number,
    nextDue: string,
    kind: 'sip' | 'bill' | 'monthly',
    categoryId: string | null,
    accountId: string,
  ): Omit<Recurring, 'updatedAt'> => ({ id, title, icon, amountPaise: rupees * 100, cadence: 'monthly', nextDue, kind, direction: 'out', categoryId, accountId });
  await db.recurring.putMany([
    more('rec-mirae-large-cap-sip', 'Mirae Asset Large Cap SIP', 'trending_up', 2000, '2026-11-10', 'sip', null, 'acc-sbi'),
    more('rec-airtel-broadband', 'Airtel broadband', 'wifi', 1179, '2026-11-15', 'bill', 'bills', 'acc-hdfc'),
    more('rec-jio-recharge', 'Jio recharge', 'smartphone', 299, '2026-11-18', 'monthly', 'bills', 'acc-icici'),
    more('rec-bescom', 'BESCOM electricity', 'bolt', 1840, '2026-11-20', 'bill', 'bills', 'acc-hdfc'),
    more('rec-google-one', 'Google One', 'cloud', 130, '2026-11-22', 'monthly', 'bills', 'acc-icici'),
  ]);
  // Balances follow entries: record each account's opening balance so today's figures stay as designed.
  await rebaseOpeningBalances(db);
  await db.meta.set(SEED_FLAG, '1');
}

function specialCat(name: string): string {
  if (name === 'BESCOM') return 'bills';
  if (name === 'BigBasket') return 'groceries';
  if (name.startsWith('PVR')) return 'entertainment';
  return 'eating-out';
}

function base(): Omit<Entry, 'id' | 'updatedAt' | 'merchant' | 'at' | 'amountPaise' | 'categoryId'> {
  return {
    direction: 'out',
    note: null,
    accountId: 'acc-hdfc',
    method: 'debit' as PayMethod,
    upiId: null,
    sources: [{ kind: 'sms' }],
    status: 'confirmed',
    aiAdded: false,
  };
}

function viaToMethod(
  it: EntryItem,
  upiIdOf: (h: string) => string,
): { method: PayMethod; accountId: string | null; upiId: string | null } {
  if (it.via.startsWith('UPI')) {
    const handle = it.via.split('\u00B7')[1].trim();
    return { method: 'upi', accountId: handle === 'rahul@okhdfc' ? 'acc-hdfc' : 'acc-sbi', upiId: upiIdOf(handle) };
  }
  if (it.via.startsWith('ICICI')) return { method: 'card', accountId: 'acc-icici', upiId: null };
  if (it.via.startsWith('HDFC debit')) return { method: 'debit', accountId: 'acc-hdfc', upiId: null };
  if (it.via === 'Cash') return { method: 'cash', accountId: 'acc-cash', upiId: null };
  return { method: 'bank', accountId: 'acc-hdfc', upiId: null };
}

/** Seed once: does nothing when the flag is already set or the database already has accounts. */
export async function seedIfEmpty(db: BacchatDb): Promise<boolean> {
  if ((await db.meta.get(SEED_FLAG)) === '1') return false;
  if ((await db.accounts.list()).length > 0) return false;
  await seedFromSampleData(db);
  return true;
}

/** Exposed for tests: the expected total of seeded funds in paise. */
export const SEEDED_FUNDS_PAISE = FUNDS.filter((f) => f.kind === 'mf').reduce(
  (s, f) => s + holdingValuePaise(micro(f.units), micro(f.nav)),
  0,
);
