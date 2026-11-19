/** Month summary: own-account moves are not spend, merchants or income; big one-offs are split out. */
import { createMemoryDb } from '../../../data/db';
import { BIG_SPEND_PAISE, monthSummary } from '../summary/summaryData';

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
