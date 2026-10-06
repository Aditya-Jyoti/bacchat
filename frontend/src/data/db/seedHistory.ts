/**
 * Deterministic older history for the sample notebook: March to September 2026. September's spend
 * per category is sized so October's "vs last month" deltas match the design, and every month from
 * May has money in and out that match the design's cash flow chart. Nothing here uses Math.random.
 */
import type { Entry, EntrySourceKind, PayMethod } from './models';

export type EntryDraft = Omit<Entry, 'id' | 'updatedAt'>;

/** Small seeded PRNG (mulberry32): same seed, same sequence. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Split a whole-rupee total into n positive whole-rupee parts that add up exactly. */
export function splitRupees(total: number, n: number, rnd: () => number): number[] {
  const count = Math.max(1, Math.min(n, Math.floor(total / 10)));
  const weights = Array.from({ length: count }, () => 0.35 + rnd() * 1.3);
  const sum = weights.reduce((s, w) => s + w, 0);
  const parts = weights.map((w) => Math.max(10, Math.floor((total * w) / sum)));
  // Put the difference on the largest part so no part turns zero or negative.
  const big = parts.indexOf(Math.max(...parts));
  parts[big] += total - parts.reduce((s, p) => s + p, 0);
  return parts;
}

const MERCHANTS: Record<string, string[]> = {
  'eating-out': ['Swiggy', 'Zomato', 'Toit', 'Chai Point', 'Third Wave Coffee', 'Biryani Blues', 'Dominos'],
  groceries: ['Zepto', 'BigBasket', 'Blinkit', 'Ramesh Fruits', 'Natures Basket'],
  shopping: ['Myntra', 'Amazon', 'Decathlon', 'Ajio', 'Reliance Trends'],
  bills: ['BESCOM', 'Airtel', 'Jio', 'Google One', 'Water bill'],
  transport: ['Uber', 'Namma Metro', 'Rapido', 'Ola', 'Petrol pump'],
  'everything-else': ['BookMyShow', 'Medplus', 'Apollo Pharmacy', 'PVR Cinemas', 'Gift shop'],
};

export const merchantFor = (categoryId: string, k: number): string => {
  const list = MERCHANTS[categoryId] ?? ['Small payments'];
  return list[k % list.length];
};

const SOURCES: EntrySourceKind[] = ['sms', 'sms', 'sms', 'mail', 'hand', 'hand', 'shot'];
const METHODS: PayMethod[] = ['card', 'upi', 'upi', 'debit', 'card', 'upi', 'cash'];

/** Which month, 0-based, each older month is (March is 2). */
const MONTH_PLAN = [
  { month: 2, spend: 30000, client: 30000, card: 20000 },
  { month: 3, spend: 32000, client: 35000, card: 22000 },
  { month: 4, spend: 33000, client: 37000, card: 21000 },
  { month: 5, spend: 35000, client: 37000, card: 26000 },
  { month: 6, spend: 31000, client: 43000, card: 18000 },
  { month: 7, spend: 36000, client: 37000, card: 36000 },
  // September: the spend is the sum of the sample's per-category last-month figures.
  { month: 8, spend: -1, client: 37000, card: 24580 },
] as const;

const MONTH_FIXED_COUNT = 7; // salary, roommate, client, rent, two SIPs, card bill

type Bank = { accountId: string; upiId: string | null; method: PayMethod };
const HDFC: Bank = { accountId: 'acc-hdfc', upiId: null, method: 'bank' };
const SBI: Bank = { accountId: 'acc-sbi', upiId: null, method: 'bank' };

/**
 * Older entries. `septCategoryRupees` is September's spend per category id, `count` the number of
 * entries to produce in all, so the notebook can reach a chosen size.
 */
export function buildHistory(septCategoryRupees: Record<string, number>, count: number): EntryDraft[] {
  const rnd = makeRng(20261024);
  const out: EntryDraft[] = [];
  const septTotal = Object.values(septCategoryRupees).reduce((s, v) => s + v, 0);
  const plan = MONTH_PLAN.map((p) => ({ ...p, spend: p.spend < 0 ? septTotal : p.spend }));
  const spendCount = count - plan.length * MONTH_FIXED_COUNT;
  const totalSpend = plan.reduce((s, p) => s + p.spend, 0);
  let left = spendCount;

  const draft = (p: Partial<EntryDraft> & { amountPaise: number; at: number; merchant: string }): EntryDraft => ({
    direction: 'out',
    note: null,
    categoryId: null,
    accountId: 'acc-hdfc',
    method: 'bank',
    upiId: null,
    sources: [{ kind: 'sms' }],
    status: 'confirmed',
    aiAdded: false,
    ...p,
  });
  const at = (month: number, day: number, h: number, min = 0): number => new Date(2026, month, day, h, min).getTime();

  plan.forEach((p, mi) => {
    const m = p.month;
    const n = mi === plan.length - 1 ? left : Math.round((spendCount * p.spend) / totalSpend);
    left -= n;
    // Categories: September uses the sample's figures, other months use the same shares.
    const shares = Object.entries(septCategoryRupees);
    let rest = p.spend;
    const cats = shares.map(([id, v], i) => {
      const r = i === shares.length - 1 ? rest : Math.round((p.spend * v) / septTotal);
      rest -= r;
      return { id, rupees: r };
    });
    let used = 0;
    cats.forEach((c, i) => {
      const cn = i === cats.length - 1 ? n - used : Math.max(1, Math.round((n * c.rupees) / p.spend));
      used += cn;
      splitRupees(c.rupees, cn, rnd).forEach((rupees, k) => {
        const day = 1 + Math.floor(rnd() * 28);
        const method = METHODS[Math.floor(rnd() * METHODS.length)];
        const handle = rnd() < 0.7 ? 'upi-okhdfc' : 'upi-ybl';
        const acct =
          method === 'cash' ? 'acc-cash' : method === 'card' ? (rnd() < 0.6 ? 'acc-icici' : 'acc-hdfc-card') : method === 'upi' ? (handle === 'upi-okhdfc' ? 'acc-hdfc' : 'acc-sbi') : 'acc-hdfc';
        out.push(
          draft({
            amountPaise: rupees * 100,
            at: at(m, day, 8 + Math.floor(rnd() * 14), Math.floor(rnd() * 60)),
            merchant: merchantFor(c.id, k + i + day),
            categoryId: c.id,
            accountId: acct,
            method,
            upiId: method === 'upi' ? handle : null,
            sources: [{ kind: SOURCES[Math.floor(rnd() * SOURCES.length)] }],
          }),
        );
      });
    });

    // Money in: salary, a roommate share and a client payment.
    out.push(draft({ amountPaise: 70000 * 100, direction: 'in', at: at(m, 1, 9), merchant: 'Salary', categoryId: 'income', ...SBI }));
    out.push(draft({ amountPaise: 5000 * 100, direction: 'in', at: at(m, 12, 20), merchant: 'Roommate share', categoryId: 'income', accountId: 'acc-sbi', method: 'upi', upiId: 'upi-ybl' }));
    out.push(draft({ amountPaise: p.client * 100, direction: 'in', at: at(m, 9, 11), merchant: 'Client payment', categoryId: 'income', accountId: 'acc-hdfc', method: 'upi', upiId: 'upi-okhdfc' }));
    // Money out that is not everyday spend: rent, SIPs and the card bill.
    out.push(draft({ amountPaise: 22000 * 100, at: at(m, 1, 10), merchant: 'Rent', categoryId: 'rent', ...HDFC }));
    out.push(draft({ amountPaise: 3000 * 100, at: at(m, 25, 7), merchant: 'Axis Bluechip SIP', categoryId: 'investments', ...SBI }));
    out.push(draft({ amountPaise: 5000 * 100, at: at(m, 5, 7), merchant: 'Parag Parikh Flexi Cap SIP', categoryId: 'investments', ...SBI }));
    out.push(draft({ amountPaise: p.card * 100, at: at(m, 28, 19), merchant: 'ICICI card bill', categoryId: 'transfers', ...HDFC }));
  });
  return out;
}
