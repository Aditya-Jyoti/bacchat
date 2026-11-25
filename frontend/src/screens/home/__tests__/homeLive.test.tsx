/** k1 Home on live data: net worth series, allocation, dues insight, budget alerts, empty and loading states. */
import { useBudget } from '../../you/budgetStore';
import { act, fireEvent, waitFor, within } from '@testing-library/react-native';
import React from 'react';

import { createMemoryDb, type BacchatDb } from '../../../data/db';
import { renderWithTheme } from '../../../testUtils';
import K1_Home from '../K1_Home';
import { useBudgetAlerts } from '../alertsStore';
import { DAILY_POINTS, duesCopy, duesInsight, reconstructDaily, reconstructSeries, sampleSeriesFor } from '../liveData';
import { useHomeConfig } from '../../../data';

const NOW = new Date(2026, 9, 24, 21, 30).getTime();
const at = (m: number, d: number, h = 12): number => new Date(2026, m, d, h).getTime();

async function smallDb(): Promise<BacchatDb> {
  const db = createMemoryDb();
  await db.accounts.putMany([
    { id: 'a1', name: 'HDFC Savings', kind: 'bank', balancePaise: 5_00_000_00, icon: 'account_balance' },
    { id: 'c1', name: 'ICICI Card', kind: 'card', balancePaise: 0, icon: 'credit_card' },
  ]);
  await db.debts.put({ id: 'd1', accountId: 'c1', dueDay: 31, outstandingPaise: 10_000_00, limitPaise: 1_00_000_00 });
  await db.categories.putMany([
    { id: 'eating-out', name: 'Eating out', icon: 'restaurant' },
    { id: 'income', name: 'Income', icon: 'payments' },
  ]);
  await db.entries.putMany([
    { id: 'e1', amountPaise: 50_000_00, direction: 'in', at: at(9, 1), merchant: 'Salary', categoryId: 'income', accountId: 'a1', method: 'bank', sources: [{ kind: 'hand' }], status: 'confirmed', aiAdded: false },
    { id: 'e2', amountPaise: 8_000_00, direction: 'out', at: at(9, 10), merchant: 'Swiggy', categoryId: 'eating-out', accountId: 'a1', method: 'debit', sources: [{ kind: 'sms' }], status: 'confirmed', aiAdded: false },
  ]);
  return db;
}

beforeEach(() => {
  act(() => useHomeConfig.getState().reset());
  act(() => useBudgetAlerts.getState().clear());
});

describe('net worth series', () => {
  it('sample series ends on the live net worth and keeps the design delta', () => {
    const s = sampleSeriesFor(18_22_350_00);
    expect(s.values).toHaveLength(12);
    expect(s.values[11]).toBe(18_22_350_00);
    expect(s.deltaPaise).toBe(24_180_00);
    expect(s.since).toBe('since 1 Sep');
  });

  it('rebuilds month ends from entries: money in later lowers the earlier points', async () => {
    const db = await smallDb();
    const s = await reconstructSeries(db, NOW, 3);
    // Net now = 5,00,000 own - 10,000 owed. October flows: +50,000 in, -8,000 out.
    expect(s.values[2]).toBe(4_90_000_00);
    expect(s.values[1]).toBe(4_90_000_00 - 42_000_00);
    expect(s.labels).toEqual(['Aug', 'Sep', 'Oct']);
    expect(s.deltaPaise).toBe(42_000_00);
    expect(s.since).toBe('since 1 Oct');
  });
});

describe('daily net worth (1M)', () => {
  it('has one point per day for the last 30 days, stepping on the days money moved', async () => {
    const db = await smallDb();
    const d = await reconstructDaily(db, NOW, undefined, 30);
    expect(d.values).toHaveLength(30);
    expect(d.labels[29]).toBe('24 Oct');
    expect(d.labels[0]).toBe('25 Sep');
    // Today is the live figure. Before the 8,000 spend on 10 Oct net worth was 8,000 higher.
    expect(d.values[29]).toBe(4_90_000_00);
    const tenth = d.labels.indexOf('10 Oct');
    expect(d.values[tenth]).toBe(4_90_000_00);
    expect(d.values[tenth - 1]).toBe(4_98_000_00);
    // And before the 50,000 salary on 1 Oct it was 50,000 lower.
    const first = d.labels.indexOf('1 Oct');
    expect(d.values[first - 1]).toBe(4_98_000_00 - 50_000_00);
  });

  it('moves between your own accounts do not change it', async () => {
    const db = await smallDb();
    await db.entries.put({ id: 'm1', amountPaise: 20_000_00, direction: 'out', at: at(9, 15), merchant: 'To card', categoryId: null, accountId: 'a1', transferToAccountId: 'c1', method: 'bank', sources: [{ kind: 'hand' }], status: 'confirmed', aiAdded: false });
    const d = await reconstructDaily(db, NOW);
    const i = d.labels.indexOf('15 Oct');
    expect(d.values[i]).toBe(d.values[i - 1]);
  });

  it('the monthly series carries 90 daily points for the 1M and 3M chips', async () => {
    const s = await reconstructSeries(await smallDb(), NOW, 3);
    expect(s.daily?.values).toHaveLength(DAILY_POINTS);
    expect(DAILY_POINTS).toBe(90);
  });

  it('says so when most income is missing (salary not added), and not when it is there', async () => {
    const db = await smallDb();
    expect((await reconstructSeries(db, NOW, 3)).incomeShort).toBe(false);
    await db.entries.put({ id: 'big', amountPaise: 2_00_000_00, direction: 'out', at: at(9, 12), merchant: 'Trip', categoryId: null, accountId: 'a1', method: 'upi', sources: [{ kind: 'hand' }], status: 'confirmed', aiAdded: false });
    expect((await reconstructSeries(db, NOW, 3)).incomeShort).toBe(true);
  });
});

describe('dues insight', () => {
  it('names the bank that covers the bills, in calm words', async () => {
    const db = await smallDb();
    const d = await duesInsight(db, NOW);
    expect(d).toMatchObject({ count: 1, totalPaise: 10_000_00, days: 7, bankName: 'HDFC Savings' });
    expect(duesCopy(d!)).toBe('One card bill (\u20B910,000) is due in 7 days. HDFC Savings covers it with room to spare.');
  });

  it('says so gently when the banks do not cover them', () => {
    expect(duesCopy({ count: 2, totalPaise: 20_000_00, days: 12, bankName: 'SBI', bankPaise: 5_000_00 })).toBe(
      'Two card bills (\u20B920,000) are due in 12 days. A small top-up from savings keeps it easy.',
    );
  });

  it('is null when no card owes anything', async () => {
    expect(await duesInsight(createMemoryDb(), NOW)).toBeNull();
  });
});

describe.each(['light', 'dark'] as const)('k1 Home live (%s)', (mode) => {
  it('shows a skeleton first, then the numbers from the database', async () => {
    const { getByTestId, findByText, queryByTestId } = renderWithTheme(<K1_Home />, mode);
    expect(getByTestId('hero-loading')).toBeTruthy();
    expect(await findByText('\u20B918,22,350')).toBeTruthy();
    expect(queryByTestId('hero-loading')).toBeNull();
  });

  it('reflects a change in the database without a reload', async () => {
    const { findByText, services } = renderWithTheme(<K1_Home />, mode);
    await findByText('\u20B918,22,350');
    await act(async () => {
      const cash = (await services.db.accounts.list()).find((a) => a.kind === 'cash');
      await services.db.accounts.put({ ...(cash as NonNullable<typeof cash>), balancePaise: 12_000_00 + 1_00_000 });
    });
    expect(await findByText('\u20B918,23,350')).toBeTruthy();
  });

  it('allocation follows the accounts; a brand new database shows calm empty states', async () => {
    // A new notebook has no overall budget (Start fresh clears the sample one).
    useBudget.getState().clear();
    const { findByText, queryByText, getByText } = renderWithTheme(<K1_Home />, mode, { servicesOptions: { seed: false } });
    expect(await findByText('Nothing spent this month yet.')).toBeTruthy();
    expect(getByText('No goals yet. Start one in Goals.')).toBeTruthy();
    expect(getByText('No budget yet. Set one when you are ready.')).toBeTruthy();
    expect(getByText('Nothing due in the next few weeks.')).toBeTruthy();
    expect(queryByText(/card bill/)).toBeNull();
    useBudget.getState().reset();
  });

  it('shows the overall monthly budget on Home even with no separate budgets', async () => {
    useBudget.getState().save({ totalPaise: 2000000, nudge: '90', rollover: true });
    const { findByText, getByTestId } = renderWithTheme(<K1_Home />, mode, { servicesOptions: { seed: false } });
    expect(await findByText(/left of \u20B920,000/)).toBeTruthy();
    // Nothing spent yet: the captions under the bar say so.
    const captions = within(getByTestId('home-budget-captions'));
    expect(captions.getByText('\u20B90 spent')).toBeTruthy();
    expect(captions.getByText('\u20B920,000 left')).toBeTruthy();
    useBudget.getState().reset();
  });

  it('lists every goal on Home, with reached ones tagged Done at the bottom', async () => {
    const db = await smallDb();
    await db.goals.putMany([
      { id: 'g-fun', name: 'Fun', icon: 'star', targetPaise: 20_000_00, accountId: 'a1' },
      { id: 'g-laptop', name: 'Laptop', icon: 'laptop_mac', targetPaise: 1_50_000_00, accountId: 'a1' },
      { id: 'g-trip', name: 'Trip', icon: 'flight', targetPaise: 40_000_00, accountId: 'a1' },
      { id: 'g-round', name: 'Round Ups', icon: 'savings', targetPaise: 0, accountId: 'a1' },
    ]);
    await db.allocations.putMany([
      { id: 'x1', goalId: 'g-fun', accountId: 'a1', amountPaise: 20_185_00 },
      { id: 'x2', goalId: 'g-laptop', accountId: 'a1', amountPaise: 60_460_00 },
      { id: 'x3', goalId: 'g-trip', accountId: 'a1', amountPaise: 10_000_00 },
      { id: 'x4', goalId: 'g-round', accountId: 'a1', amountPaise: 731_00 },
    ]);
    const { findByText, getByTestId, getByText, queryByText } = renderWithTheme(<K1_Home />, mode, { db, servicesOptions: { seed: false, now: () => NOW } });
    expect(await findByText('\u20B920,185 \u00B7 Done')).toBeTruthy();
    const names = within(getByTestId('section-goals'))
      .getAllByRole('button')
      .map((b) => String(b.props.accessibilityLabel ?? ''))
      .filter((l) => /^(Fun|Laptop|Trip|Round Ups),/.test(l))
      .map((l) => l.split(',')[0]);
    expect(names).toEqual(['Laptop', 'Trip', 'Round Ups', 'Fun']);
    // An open pot has no target: just its amount, never "/ Rs 0".
    expect(getByText('\u20B9731')).toBeTruthy();
    expect(queryByText(/\/ \u20B90/)).toBeNull();
  });

  it('a card with a bill day shows the bill to pay and this cycle as two lines', async () => {
    const NOW = new Date(2026, 10, 26, 18).getTime();
    const db = createMemoryDb();
    await db.accounts.put({ id: 'cc', name: 'Slice Credit', kind: 'card', balancePaise: 0, openingBalancePaise: 0, icon: 'credit_card' });
    await db.debts.put({ id: 'd-cc', accountId: 'cc', dueDay: 9, statementDay: 25, outstandingPaise: 0, openingOutstandingPaise: 0, limitPaise: 1_76_000_00 });
    const spend = (id: string, day: number, rs: number) => ({ id, amountPaise: rs * 100, direction: 'out' as const, at: new Date(2026, 10, day, 12).getTime(), merchant: id, note: null, categoryId: null, accountId: 'cc', method: 'card' as const, upiId: null, sources: [{ kind: 'shot' as const }], status: 'confirmed' as const, aiAdded: false });
    await db.entries.putMany([spend('Zomato', 20, 69_270), spend('Amazon', 26, 2_304)]);
    const { findByText, getByText, queryByText } = renderWithTheme(<K1_Home />, mode, { db, servicesOptions: { seed: false, now: () => NOW } });
    expect(await findByText('Card bill')).toBeTruthy();
    expect(getByText('Pay by 9 Dec')).toBeTruthy();
    expect(getByText('\u20B969,270')).toBeTruthy();
    expect(getByText('Card, this cycle')).toBeTruthy();
    expect(getByText('Next bill on 25 Dec')).toBeTruthy();
    expect(getByText('\u20B92,304')).toBeTruthy();
    expect(queryByText('Card dues')).toBeNull();
  });

  it('This month shows the pace in words, a share bar, the top three and the rest together', async () => {
    const NOW = new Date(2026, 10, 26, 18).getTime();
    const db = createMemoryDb();
    await db.accounts.put({ id: 'sb', name: 'Slice Savings', kind: 'bank', balancePaise: 1_00_000_00, openingBalancePaise: 1_00_000_00, icon: 'account_balance' });
    await db.categories.putMany(['Travel', 'Food', 'Groceries', 'Fun', 'Gifts'].map((n) => ({ id: n.toLowerCase(), name: n, icon: 'category' })));
    const e = (id: string, cat: string, m: number, day: number, rs: number) => ({ id, amountPaise: rs * 100, direction: 'out' as const, at: new Date(2026, m, day, 12).getTime(), merchant: id, note: null, categoryId: cat, accountId: 'sb', method: 'upi' as const, upiId: null, sources: [{ kind: 'hand' as const }], status: 'confirmed' as const, aiAdded: false });
    await db.entries.putMany([e('a', 'travel', 10, 3, 26_000), e('b', 'food', 10, 5, 13_000), e('c', 'groceries', 10, 6, 6_500), e('d', 'fun', 10, 7, 2_600), e('f', 'gifts', 10, 8, 1_300), e('old', 'food', 9, 10, 10_000)]);
    const { findByTestId, getByTestId, getByText } = renderWithTheme(<K1_Home />, mode, { db, servicesOptions: { seed: false, now: () => NOW } });
    expect((await findByTestId('spend-pace')).props.children).toBe('About \u20B91,900 a day so far, \u20B939,400 more than Oct by this point.');
    expect(getByTestId('spend-top-Travel')).toBeTruthy();
    expect(getByTestId('spend-top-Groceries')).toBeTruthy();
    expect(getByText('2 more categories')).toBeTruthy();
    expect(getByText('See the whole month')).toBeTruthy();
  });

  it('uses the real clock greeting outside sample mode', async () => {
    const { findByText } = renderWithTheme(<K1_Home />, mode, { servicesOptions: { seed: false, now: () => new Date(2026, 10, 3, 8, 15).getTime() } });
    expect(await findByText('Good morning')).toBeTruthy();
    expect(await findByText('Tue, 3 Nov')).toBeTruthy();
  });

  it('shows a budget alert in the caution container once, with Raise and Okay', async () => {
    const db = await smallDb();
    await db.budgets.put({ id: 'b1', categoryId: 'eating-out', monthlyPaise: 6_000_00 });
    const { findByTestId, queryByTestId, getByText, services } = renderWithTheme(<K1_Home />, mode, {
      db,
      servicesOptions: { seed: false, now: () => NOW },
    });
    const banner = await findByTestId('alert-eating-out');
    expect(banner).toBeTruthy();
    expect(getByText(/Eating out went \u20B92,000 past its budget\./)).toBeTruthy();
    expect(getByText(/One card bill/)).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByText('Raise to \u20B98,000'));
    });
    await waitFor(() => expect(queryByTestId('alert-eating-out')).toBeNull());
    expect((await services.db.budgets.list())[0].monthlyPaise).toBe(8_000_00);
    expect(await services.db.alerts.has('eating-out', '2026-10')).toBe(true);
  });

  it('Okay dismisses the alert and it does not come back', async () => {
    const db = await smallDb();
    await db.budgets.put({ id: 'b1', categoryId: 'eating-out', monthlyPaise: 6_000_00 });
    const { findByTestId, queryByTestId, getByTestId } = renderWithTheme(<K1_Home />, mode, { db, servicesOptions: { seed: false, now: () => NOW } });
    await findByTestId('alert-eating-out');
    fireEvent.press(getByTestId('alert-okay-eating-out'));
    expect(queryByTestId('alert-eating-out')).toBeNull();
    expect(useBudgetAlerts.getState().alerts).toHaveLength(0);
  });
});
