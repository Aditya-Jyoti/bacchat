/** k1 Home on live data: net worth series, allocation, dues insight, budget alerts, empty and loading states. */
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createMemoryDb, type BacchatDb } from '../../../data/db';
import { renderWithTheme } from '../../../testUtils';
import K1_Home from '../K1_Home';
import { useBudgetAlerts } from '../alertsStore';
import { duesCopy, duesInsight, reconstructSeries, sampleSeriesFor } from '../liveData';
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
    const { findByText, queryByText, getByText } = renderWithTheme(<K1_Home />, mode, { servicesOptions: { seed: false } });
    expect(await findByText('Nothing spent this month yet.')).toBeTruthy();
    expect(getByText('No goals yet. Start one in Goals.')).toBeTruthy();
    expect(getByText('No budget yet. Set one when you are ready.')).toBeTruthy();
    expect(getByText('Nothing due in the next few weeks.')).toBeTruthy();
    expect(queryByText(/card bill/)).toBeNull();
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
