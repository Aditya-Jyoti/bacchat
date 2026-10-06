import React from 'react';
import { act, render, renderHook, waitFor } from '@testing-library/react-native';

import { SAMPLE_TODAY, createMemoryDb } from '../../data/db';
import {
  AppServicesProvider,
  createTestServices,
  useAccounts,
  useBudgetPace,
  useCashFlow,
  useDailyTotals,
  useDbQuery,
  useDebts,
  useEntries,
  useGoalsWithTotals,
  useNetWorth,
  useNow,
  useServices,
  useServicesReady,
  useSpendable,
  useSpendByCategory,
  useToReviewEntries,
  useUpcoming,
  useUpiFlows,
  useWriters,
  type Services,
} from '..';

function setup(services: Services = createTestServices()) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppServicesProvider services={services}>{children}</AppServicesProvider>
  );
  return { services, wrapper };
}

async function loaded<T>(result: { current: { data: T | undefined; loading: boolean } }) {
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeDefined();
  });
  return result.current.data as T;
}

describe('provider and context', () => {
  it('throws outside a provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useServices())).toThrow(/AppServicesProvider/);
    spy.mockRestore();
  });

  it('provides services, ready flag and the sample clock', () => {
    const { wrapper, services } = setup();
    const { result } = renderHook(() => ({ s: useServices(), ready: useServicesReady(), now: useNow() }), { wrapper });
    expect(result.current.s).toBe(services);
    expect(result.current.ready).toBe(true);
    expect(result.current.now).toBe(SAMPLE_TODAY);
  });

  it('renders nothing until services open, then its children', async () => {
    const Probe = () => {
      useServices();
      return null;
    };
    const { toJSON } = render(
      <AppServicesProvider options={{ db: createMemoryDb() }}>
        <Probe />
      </AppServicesProvider>,
    );
    expect(toJSON()).toBeNull();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  });
});

describe('useDbQuery', () => {
  it('loads, exposes errors, and refreshes on writes and refresh()', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(
      () => {
        const q = useDbQuery((db) => db.categories.list());
        return { q, w: useWriters() };
      },
      { wrapper },
    );
    expect(result.current.q.loading).toBe(true);
    await waitFor(() => expect(result.current.q.data?.length).toBeGreaterThan(0));
    const n = result.current.q.data!.length;
    await act(async () => {
      await result.current.w.categories.put({ id: 'new-cat', name: 'New', icon: 'star' });
    });
    await waitFor(() => expect(result.current.q.data?.length).toBe(n + 1));
    await act(async () => {
      await result.current.q.refresh();
    });
    expect(result.current.q.error).toBeNull();
  });

  it('reports errors and re-runs when deps change', async () => {
    const { wrapper } = setup();
    const { result, rerender } = renderHook(
      ({ fail, tag }: { fail: boolean; tag: string }) =>
        useDbQuery(async () => {
          if (fail) throw new Error('boom');
          return tag;
        }, [fail, tag]),
      { wrapper, initialProps: { fail: true, tag: 'a' } },
    );
    await waitFor(() => expect(result.current.error?.message).toBe('boom'));
    rerender({ fail: false, tag: 'b' });
    await waitFor(() => expect(result.current.data).toBe('b'));
    expect(result.current.error).toBeNull();
  });
});

describe('derived-query hooks on the seeded sample', () => {
  it('net worth, spendable', async () => {
    const { wrapper } = setup();
    const nw = renderHook(() => useNetWorth(), { wrapper });
    const sp = renderHook(() => useSpendable(), { wrapper });
    const w = await loaded(nw.result);
    expect(w.netPaise).toBe(w.ownPaise - w.owePaise);
    expect(w.owePaise).toBeGreaterThan(0);
    const s = await loaded(sp.result);
    expect(s.paise).toBe(s.liquidPaise - s.cardDuesPaise);
  });

  it('spend by category, daily totals, cash flow', async () => {
    const { wrapper } = setup();
    const cat = await loaded(renderHook(() => useSpendByCategory(), { wrapper }).result);
    expect(cat.totalPaise).toBeGreaterThan(0);
    expect(cat.categories.length).toBeGreaterThan(0);
    const daily = await loaded(renderHook(() => useDailyTotals(), { wrapper }).result);
    expect(daily.days.length).toBeGreaterThan(20);
    const flow = await loaded(renderHook(() => useCashFlow(3), { wrapper }).result);
    expect(flow).toHaveLength(3);
  });

  it('goals with totals, budget pace, upcoming, upi flows', async () => {
    const { wrapper } = setup();
    const goals = await loaded(renderHook(() => useGoalsWithTotals(), { wrapper }).result);
    expect(goals.length).toBeGreaterThan(0);
    expect(goals[0].total.goalId).toBe(goals[0].goal.id);
    expect(goals.some((g) => g.total.savedPaise > 0)).toBe(true);
    const pace = await loaded(renderHook(() => useBudgetPace(), { wrapper }).result);
    expect(pace.length).toBeGreaterThan(0);
    const up = await loaded(renderHook(() => useUpcoming(45), { wrapper }).result);
    expect(up.length).toBeGreaterThan(0);
    const upi = await loaded(renderHook(() => useUpiFlows(), { wrapper }).result);
    expect(upi).toHaveLength(3);
  });

  it('accounts and debts (with names)', async () => {
    const { wrapper } = setup();
    const accounts = await loaded(renderHook(() => useAccounts(), { wrapper }).result);
    expect(accounts.map((a) => a.name)).toContain('HDFC Savings');
    const debts = await loaded(renderHook(() => useDebts(), { wrapper }).result);
    expect(debts.map((d) => d.name).sort()).toEqual(['HDFC Millennia', 'ICICI Amazon Pay']);
  });
});

describe('entry hooks', () => {
  it('filters by range and filter, newest first', async () => {
    const { wrapper } = setup();
    const all = await loaded(renderHook(() => useEntries(), { wrapper }).result);
    expect(all.length).toBeGreaterThan(30);
    expect([...all].sort((a, b) => b.at - a.at).map((e) => e.id)).toEqual(all.map((e) => e.id));
    const day = new Date(2026, 9, 24).getTime();
    const today = await loaded(
      renderHook(() => useEntries({ range: { fromMs: day, toMs: day + 86400000 } }), { wrapper }).result,
    );
    expect(today.length).toBeGreaterThan(0);
    expect(today.every((e) => e.at >= day && e.at < day + 86400000)).toBe(true);
    const incomes = await loaded(renderHook(() => useEntries({ filter: { direction: 'in' } }), { wrapper }).result);
    expect(incomes.length).toBeGreaterThan(0);
    expect(incomes.every((e) => e.direction === 'in')).toBe(true);
    const found = await loaded(renderHook(() => useEntries({ filter: { text: 'swiggy' } }), { wrapper }).result);
    expect(found.every((e) => e.merchant.toLowerCase().includes('swiggy'))).toBe(true);
    const upiOnly = await loaded(renderHook(() => useEntries({ filter: { method: 'upi' } }), { wrapper }).result);
    expect(upiOnly.every((e) => e.method === 'upi')).toBe(true);
  });

  it('to-review entries drop out after confirming, via the change notifier', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ r: useToReviewEntries(), w: useWriters(), nw: useNetWorth() }), { wrapper });
    await waitFor(() => expect(result.current.r.data?.length).toBeGreaterThan(0));
    const before = result.current.r.data!.length;
    const id = result.current.r.data![0].id;
    await act(async () => {
      await result.current.w.entries.confirm(id);
    });
    await waitFor(() => expect(result.current.r.data?.length).toBe(before - 1));
  });

  it('net worth updates after an account write', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ nw: useNetWorth(), w: useWriters() }), { wrapper });
    await waitFor(() => expect(result.current.nw.data).toBeDefined());
    const first = result.current.nw.data!;
    await act(async () => {
      await result.current.w.accounts.put({
        id: 'acc-new',
        name: 'Piggy',
        kind: 'cash',
        balancePaise: 5000_00,
        icon: 'savings',
      });
    });
    await waitFor(() => expect(result.current.nw.data?.ownPaise).toBe(first.ownPaise + 5000_00));
  });
});

describe('empty database', () => {
  it('returns zeroes and empty lists with seed off', async () => {
    const { wrapper } = setup(createTestServices({ seed: false }));
    const nw = await loaded(renderHook(() => useNetWorth(), { wrapper }).result);
    expect(nw.netPaise).toBe(0);
    expect(await loaded(renderHook(() => useEntries(), { wrapper }).result)).toEqual([]);
    expect(await loaded(renderHook(() => useGoalsWithTotals(), { wrapper }).result)).toEqual([]);
  });
});
