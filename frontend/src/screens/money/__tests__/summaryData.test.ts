/** Month summary: own-account moves are not spend, merchants or income; big one-offs are split out. */
import { createMemoryDb } from '../../../data/db';
import { BIG_SPEND_PAISE, accountSplit, monthSummary } from '../summary/summaryData';
import { viaLabel } from '../parts/live';

const NOW = new Date(2026, 9, 24, 21, 30).getTime();
const at = (d: number) => new Date(2026, 9, d, 12).getTime();
const base = { categoryId: null, method: 'upi' as const, sources: [{ kind: 'hand' as const }], status: 'confirmed' as const, aiAdded: false };

it('leaves moves between own accounts out of merchants, methods and income, and splits big one-offs', async () => {
  const db = createMemoryDb();
  await db.accounts.putMany([
    { id: 'sb', name: 'Savings', kind: 'bank', balancePaise: 0, icon: 'a' },
    { id: 'cc', name: 'Card', kind: 'card', balancePaise: 0, icon: 'c' },
  ]);
  await db.entries.putMany([
    { ...base, id: 'e1', amountPaise: 45000, direction: 'out', at: at(3), merchant: 'Blinkit', accountId: 'sb' },
    { ...base, id: 'e2', amountPaise: 2000000, direction: 'out', at: at(5), merchant: 'Apollo Hospitals', accountId: 'sb' },
    { ...base, id: 'e3', amountPaise: 2177604, direction: 'out', at: at(6), merchant: 'Card bill', accountId: 'sb', transferToAccountId: 'cc', method: 'bank' },
    { ...base, id: 'e4', amountPaise: 5000000, direction: 'out', at: at(7), merchant: 'From SBI', accountId: 'sbi-missing', transferToAccountId: 'sb' },
    { ...base, id: 'e5', amountPaise: 1000, direction: 'in', at: at(8), merchant: 'Interest', accountId: 'sb' },
  ]);
  const s = await monthSummary(db, NOW, 0);
  expect(s.merchants.map((m) => m.name)).toEqual(['Apollo Hospitals', 'Blinkit']);
  expect(s.methods.reduce((sum, m) => sum + m.paise, 0)).toBe(2045000);
  expect(s.inPaise).toBe(1000);
  expect(s.biggest.map((e) => e.merchant)).toEqual(['Apollo Hospitals', 'Blinkit']);
  expect(BIG_SPEND_PAISE).toBe(200000);
  expect(s.oneOffCount).toBe(1);
  expect(s.oneOffPaise).toBe(2000000);
  expect(s.everydayPaise).toBe(s.spentPaise - 2000000);
});

describe('accountSplit (Paid from)', () => {
  const e = (id: string, paise: number, extra: Record<string, unknown>) =>
    ({ ...base, id, amountPaise: paise, direction: 'out', at: at(3), merchant: id, accountId: null, updatedAt: 0, ...extra }) as never;

  it('groups spends by account whatever the method, biggest first, with whole-number shares', () => {
    const r = accountSplit([
      e('a', 60000, { accountId: 'sb', method: 'upi' }),
      e('b', 20000, { accountId: 'sb', method: 'debit' }),
      e('c', 15000, { accountId: 'cc', method: 'card' }),
      e('d', 5000, { accountId: null, method: 'cash' }),
    ]);
    expect(r.map((x) => [x.accountId, x.paise, x.percent])).toEqual([
      ['sb', 80000, 80],
      ['cc', 15000, 15],
      [null, 5000, 5],
    ]);
  });

  it('keeps no-account cash apart from no-account anything else, and leaves money in and transfers out', () => {
    const r = accountSplit([
      e('a', 3000, { method: 'cash' }),
      e('b', 1000, { method: 'upi' }),
      e('c', 9000, { method: 'upi', direction: 'in', accountId: 'sb' }),
      e('d', 9000, { method: 'bank', accountId: 'sb', transferToAccountId: 'cc' }),
    ]);
    expect(r.map((x) => [x.accountId, x.method, x.paise])).toEqual([
      [null, 'cash', 3000],
      [null, 'upi', 1000],
    ]);
    expect(accountSplit([])).toEqual([]);
  });
});

it('gives each elapsed day the money that came in from others, not transfers or future days', async () => {
  const db = createMemoryDb();
  await db.accounts.putMany([{ id: 'sb', name: 'Savings', kind: 'bank', balancePaise: 0, icon: 'a' }]);
  await db.entries.putMany([
    { ...base, id: 'o', amountPaise: 1000, direction: 'out', at: at(3), merchant: 'Shop', accountId: 'sb' },
    { ...base, id: 'i1', amountPaise: 250000, direction: 'in', at: at(3), merchant: 'Asha', accountId: 'sb' },
    { ...base, id: 'i2', amountPaise: 50000, direction: 'in', at: at(3), merchant: 'Ravi', accountId: 'sb' },
    { ...base, id: 'i3', amountPaise: 99900, direction: 'in', at: at(4), merchant: 'Own move', accountId: 'sb', transferToAccountId: 'sb' },
    { ...base, id: 'i4', amountPaise: 7700, direction: 'in', at: at(28), merchant: 'Later', accountId: 'sb' },
  ]);
  const s = await monthSummary(db, NOW, 0);
  expect(s.daily.days[2].inPaise).toBe(300000);
  expect(s.daily.days[2].totalPaise).toBe(1000);
  expect(s.daily.days[3].inPaise).toBe(0);
  expect(s.daily.days[27].inPaise).toBe(0);
  expect(s.accounts.map((a) => a.accountId)).toEqual(['sb']);
});

describe('viaLabel (the account, never UPI)', () => {
  const lk = { accounts: new Map([['sb', { id: 'sb', name: 'Slice Savings' }]]), upis: new Map([['u1', { id: 'u1', accountId: 'sb' }]]), cats: new Map() } as never;
  const e = (extra: Record<string, unknown>) => ({ ...base, id: 'x', amountPaise: 1, direction: 'out', at: at(3), merchant: 'x', accountId: null, ...extra }) as never;
  it('names the account, the UPI id\'s linked account, Cash or No account', () => {
    expect(viaLabel(e({ accountId: 'sb', method: 'upi' }), lk)).toBe('Slice Savings');
    expect(viaLabel(e({ upiId: 'u1', method: 'upi' }), lk)).toBe('Slice Savings');
    expect(viaLabel(e({ method: 'cash' }), lk)).toBe('Cash');
    expect(viaLabel(e({ method: 'upi' }), lk)).toBe('No account');
  });
});
