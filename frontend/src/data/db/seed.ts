/**
 * Seed the database from the design's sample data so a fresh install can show the design's
 * numbers. Net worth, own and owe match the sample exactly. Entries are placed in October 2026
 * ("today" is Sat 24 Oct) with daily totals matching the sample for days 1 to 22, and a
 * September entry per category so the "vs last month" deltas match the sample.
 */
import * as S from '../sampleData';
import type { EntryItem } from '../types';
import type { BacchatDb } from './repositories';
import type { Account, Category, Entry, EntrySourceKind, PayMethod } from './models';
import { holdingValuePaise } from '../../lib/nav/valuation';

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
  S.entryDays.forEach((d) => d.items.forEach((i) => addCat(i.category, i.icon)));
  addCat('Entertainment', 'movie');
  addCat('Income', 'payments');
  const nameOf = new Map<string, string>();
  S.spend.forEach((c) => nameOf.set(slug(c.name), c.name));
  S.budgets.forEach((b) => nameOf.set(slug(b.name), b.name));
  S.categoryIcons.forEach(([, n]) => nameOf.set(slug(n), n));
  S.entryDays.forEach((d) => d.items.forEach((i) => nameOf.set(slug(i.category), i.category)));
  nameOf.set('entertainment', 'Entertainment');
  nameOf.set('income', 'Income');
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

  await db.upiIds.putMany(
    S.upi.map((u) => ({
      id: u.id === 'rahul@okhdfc' ? 'upi-okhdfc' : 'upi-ybl',
      handle: u.id,
      label: u.bank,
      accountId: u.bank === 'HDFC Savings' ? 'acc-hdfc' : 'acc-sbi',
    })),
  );
  const upiIdOf = (handle: string): string => (handle === 'rahul@okhdfc' ? 'upi-okhdfc' : 'upi-ybl');

  // Entries from the sample list.
  const entries: Omit<Entry, 'updatedAt'>[] = [];
  let n = 0;
  const push = (e: Omit<Entry, 'id' | 'updatedAt'>): void => {
    n += 1;
    entries.push({ id: `seed-e${String(n).padStart(3, '0')}`, ...e });
  };
  const dayMonth = [{ d: 24 }, { d: 23 }];
  S.entryDays.forEach((day, di) => {
    for (const it of day.items) {
      const { h, min } = parseClock(it.time);
      const { method, accountId, upiId } = viaToMethod(it, upiIdOf);
      const sources: EntrySourceKind[] = [it.source];
      if (it.matched) sources.push('shot');
      if (it.resolved) sources.push('shot');
      const pending = (it.source === 'sms' || it.source === 'mail') && !it.matched && !it.resolved;
      push({
        amountPaise: Math.abs(it.amount.paise),
        direction: it.income ? 'in' : 'out',
        at: at(9, dayMonth[di].d, h, min),
        merchant: it.name,
        note: null,
        categoryId: slug(it.category),
        accountId,
        method,
        upiId,
        sources: sources.map((kind) => ({ kind })),
        status: pending ? 'toReview' : 'confirmed',
        aiAdded: pending,
      });
    }
  });

  // Earlier days of October: one entry per day so daily totals equal the sample.
  const poolCat = ['eating-out', 'tea-coffee', 'transport', 'groceries', 'shopping', 'transport', 'entertainment', 'medicines'];
  const poolMerchant = ['Swiggy', 'Chai Point', 'Namma Metro', 'Zepto', 'Myntra', 'Uber', 'BookMyShow', 'Medplus'];
  S.dailySpendRupees.slice(0, 22).forEach((rupees, i) => {
    const day = i + 1;
    const special = S.dailySpecial[day];
    if (special) {
      let rest = rupees * 100;
      for (const t of special) {
        // The design's top entries can add up to more than the day's total; cap at what is left.
        const amt = Math.min(t.amount.paise, rest);
        if (amt <= 0) continue;
        push({ ...base(), amountPaise: amt, at: at(9, day, 13), merchant: t.name, categoryId: specialCat(t.name) });
        rest -= amt;
      }
      if (rest > 0) push({ ...base(), amountPaise: rest, at: at(9, day, 18), merchant: 'Small payments', categoryId: 'everything-else' });
    } else {
      push({ ...base(), amountPaise: rupees * 100, at: at(9, day, 13), merchant: poolMerchant[i % 8], categoryId: poolCat[i % 8] });
    }
  });

  // September: one entry per category so deltas match the sample's "vs last month".
  for (const c of S.spend) {
    push({ ...base(), amountPaise: c.amount.paise - c.vs.paise, at: at(8, 15), merchant: `${c.name} (September)`, categoryId: slug(c.name) });
  }
  // Income: salary each month, and one UPI credit per id.
  push({ ...base(), amountPaise: 126000 * 100, direction: 'in', at: at(9, 1, 9), merchant: 'Salary', categoryId: 'income', accountId: 'acc-sbi', method: 'bank' });
  push({ ...base(), amountPaise: 112000 * 100, direction: 'in', at: at(8, 1, 9), merchant: 'Salary', categoryId: 'income', accountId: 'acc-sbi', method: 'bank' });
  push({ ...base(), amountPaise: S.upi[0].inn.paise, direction: 'in', at: at(9, 9, 11), merchant: 'Client payment', categoryId: 'income', accountId: 'acc-hdfc', method: 'upi', upiId: 'upi-okhdfc' });
  push({ ...base(), amountPaise: S.upi[1].inn.paise, direction: 'in', at: at(9, 12, 20), merchant: 'Roommate share', categoryId: 'income', accountId: 'acc-sbi', method: 'upi', upiId: 'upi-ybl' });

  await db.entries.putMany(entries);
  for (const e of [...entries].sort((a, b) => a.at - b.at)) {
    if (e.direction === 'out' && !e.merchant.includes('(September)')) {
      await db.merchants.record(e.merchant, e.categoryId, e.amountPaise, e.at);
    }
  }

  await db.budgets.putMany(
    S.budgets.map((b) => ({ id: `bud-${slug(b.name)}`, categoryId: slug(b.name), monthlyPaise: b.limit.paise })),
  );

  const goalIds = Object.fromEntries(S.goals.map((g) => [g.name, `goal-${slug(g.name)}`]));
  await db.goals.putMany(
    S.goals.map((g) => ({
      id: goalIds[g.name],
      name: g.name,
      icon: g.icon,
      targetPaise: g.target.paise,
      targetDate: g.by,
    })),
  );
  const accOf: Record<string, string> = { 'HDFC Savings': 'acc-hdfc', 'SBI Salary': 'acc-sbi', 'Cash wallet': 'acc-cash' };
  await db.allocations.putMany([
    ...S.goalAllocation.map((a) => ({ id: `alloc-goa-${accOf[a.from]}`, goalId: goalIds['Goa with friends'], accountId: accOf[a.from], amountPaise: a.amount.paise })),
    { id: 'alloc-emergency', goalId: goalIds['Emergency fund'], accountId: 'acc-sbi', amountPaise: S.goals[1].saved.paise },
    { id: 'alloc-diwali', goalId: goalIds['Diwali gifts'], accountId: 'acc-hdfc', amountPaise: S.goals[2].saved.paise },
    { id: 'alloc-laptop', goalId: goalIds['New laptop'], accountId: 'acc-hdfc', amountPaise: S.goals[3].saved.paise },
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
