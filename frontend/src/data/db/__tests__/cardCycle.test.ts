/** @jest-environment node */
import { createMemoryDb } from '../index';
import { cardCycle, lastBillDay, nextBillDay, type DueChange } from '../queries/cardCycle';
import { upcomingBetween } from '../queries/upcoming';

const at = (m: number, d: number, h = 12): number => new Date(2026, m, d, h).getTime();
const spend = (m: number, d: number, rs: number): DueChange => ({ at: at(m, d), deltaPaise: rs * 100, payment: false });
const pay = (m: number, d: number, rs: number): DueChange => ({ at: at(m, d), deltaPaise: -rs * 100, payment: true });
const refund = (m: number, d: number, rs: number): DueChange => ({ at: at(m, d), deltaPaise: -rs * 100, payment: false });
const card = { statementDay: 25, dueDay: 9 };

describe('bill days', () => {
  it('finds the last and next bill day, clamped to short months', () => {
    expect(lastBillDay(25, at(10, 26))).toBe(new Date(2026, 10, 25).getTime());
    expect(lastBillDay(25, at(10, 24))).toBe(new Date(2026, 9, 25).getTime());
    expect(lastBillDay(25, new Date(2026, 10, 25, 0, 5).getTime())).toBe(new Date(2026, 10, 25).getTime());
    expect(lastBillDay(31, at(1, 28))).toBe(new Date(2026, 1, 28).getTime());
    expect(nextBillDay(25, new Date(2026, 10, 25).getTime())).toBe(new Date(2026, 11, 25).getTime());
  });
});

describe('cardCycle', () => {
  // Bill made 25 Nov for 25 Oct to 24 Nov; spends since then start the new cycle.
  const changes = [spend(9, 30, 50_000), refund(10, 14, 2_132.88), spend(10, 24, 50), spend(10, 25, 917), spend(10, 26, 2_304)];
  const total = (cs: DueChange[]): number => cs.reduce((s, c) => s + c.deltaPaise, 0);

  it('splits what is owed into the bill and this cycle on the bill day', () => {
    const c = cardCycle(card, total(changes), 0, changes, at(10, 26, 18))!;
    expect(c.billPaise).toBe(4_791_712);
    expect(c.billLeftPaise).toBe(4_791_712);
    expect(c.cyclePaise).toBe(322_100);
    expect(c.billDueAt).toBe(new Date(2026, 11, 9).getTime());
    expect(c.statementAt).toBe(new Date(2026, 10, 25).getTime());
  });

  it('a payment after the bill day pays the bill first; a full one leaves only this cycle', () => {
    const part = [...changes, pay(10, 28, 10_000)];
    expect(cardCycle(card, total(part), 0, part, at(10, 28, 18))!.billLeftPaise).toBe(3_791_712);
    const full = [...changes, pay(10, 28, 47_917.12)];
    const c = cardCycle(card, total(full), 0, full, at(10, 28, 18))!;
    expect(c.billLeftPaise).toBe(0);
    expect(c.cyclePaise).toBe(322_100);
  });

  it('a refund in the new cycle lowers this cycle, not the bill', () => {
    const cs = [...changes, refund(10, 27, 300)];
    const c = cardCycle(card, total(cs), 0, cs, at(10, 27, 18))!;
    expect(c.billLeftPaise).toBe(4_791_712);
    expect(c.cyclePaise).toBe(292_100);
  });

  it('no bill day: no cycle', () => {
    expect(cardCycle({ statementDay: null, dueDay: 9 }, 100, 0, [], at(10, 26))).toBeNull();
  });
});

describe('calendar (upcomingBetween) for a card with a bill day', () => {
  it('shows the bill made on the bill day and the bill due with what is left', async () => {
    const db = createMemoryDb();
    await db.accounts.put({ id: 'cc', name: 'Slice Credit', kind: 'card', balancePaise: 0, openingBalancePaise: 0, icon: 'credit_card' });
    await db.debts.put({ id: 'd', accountId: 'cc', dueDay: 9, statementDay: 25, outstandingPaise: 0, openingOutstandingPaise: 0, limitPaise: 1 });
    await db.entries.put({ id: 'e1', amountPaise: 50_000_00, direction: 'out', at: at(10, 20), merchant: 'X', note: null, categoryId: null, accountId: 'cc', method: 'card', upiId: null, sources: [{ kind: 'hand' }], status: 'confirmed', aiAdded: false });
    const now = at(10, 26);
    const items = await upcomingBetween(db, now, new Date(2026, 10, 1).getTime(), new Date(2027, 0, 1).getTime());
    const card = items.filter((i) => i.accountId === 'cc').map((i) => `${i.date} ${i.kind} ${i.amountPaise}`);
    expect(card).toEqual(['2026-11-25 cardBill 0', '2026-12-09 cardDue 5000000', '2026-12-25 cardBill 0']);
  });
});
