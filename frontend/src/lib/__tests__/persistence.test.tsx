import { useHomeConfig, defaultHomeConfig } from '../../data';
import { useMoneySegment } from '../../navigation/moneySegment';
import { useGoals, initialGoals } from '../../screens/goals/goalsStore';
import { useFirstRun } from '../../screens/start/firstRun';
import { useBudget } from '../../screens/you/budgetStore';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';

import { ThemeProvider, useTheme } from '../../theme';
import { hydrateAll, useHydrated } from '../persistence';
import { usePreferences } from '../preferences';
import { createMemoryStorage, getJSON, removeKey, setJSON, setStorage } from '../storage';

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

/** Write, wipe the in-memory state back to defaults, then rehydrate from storage. */
async function roundTrip(mutate: () => void, wipe: () => void) {
  const mem = createMemoryStorage();
  setStorage(mem);
  mutate();
  await flush();
  const saved = mem.dump();
  wipe();
  await flush();
  // Restore what was saved before the wipe, as if the app had been restarted.
  setStorage(createMemoryStorage(saved));
  await hydrateAll();
}

beforeEach(async () => {
  setStorage(createMemoryStorage());
  useHomeConfig.getState().reset();
  useGoals.getState().reset();
  useBudget.getState().reset();
  useFirstRun.setState({ seen: false });
  useMoneySegment.setState({ last: 'summary' });
  usePreferences.setState({ theme: 'system', locale: 'en' });
  await flush();
});

describe('storage', () => {
  it('stores strings and JSON, and falls back on bad data', async () => {
    const mem = createMemoryStorage();
    setStorage(mem);
    await setJSON('k', { a: 1 });
    expect(await getJSON('k', null)).toEqual({ a: 1 });
    await mem.setItem('bad', '{oops');
    expect(await getJSON('bad', 'fallback')).toBe('fallback');
    await removeKey('k');
    expect(await getJSON('k', 'none')).toBe('none');
  });
});

describe('persisted stores round-trip', () => {
  it('home config keeps order and hidden sections', async () => {
    await roundTrip(
      () => {
        useHomeConfig.getState().move(0, 3);
        useHomeConfig.getState().setEnabled('budget', false);
      },
      () => useHomeConfig.setState({ config: defaultHomeConfig() }),
    );
    const ids = useHomeConfig.getState().config;
    expect(ids[3].id).toBe(defaultHomeConfig()[0].id);
    expect(ids.find((s) => s.id === 'budget')?.enabled).toBe(false);
  });

  it('repairs a damaged home config', async () => {
    setStorage(createMemoryStorage({ 'bacchat.home': JSON.stringify({ state: { config: [{ id: 'nope' }, { id: 'goals', enabled: false }] }, version: 1 }) }));
    await hydrateAll();
    const cfg = useHomeConfig.getState().config;
    expect(cfg).toHaveLength(defaultHomeConfig().length);
    expect(cfg[0]).toEqual({ id: 'goals', enabled: false });
  });

  it('first-run flag', async () => {
    await roundTrip(() => useFirstRun.getState().markSeen(), () => useFirstRun.setState({ seen: false }));
    expect(useFirstRun.getState().seen).toBe(true);
  });

  it('money segment memory', async () => {
    await roundTrip(() => useMoneySegment.getState().setLast('entries'), () => useMoneySegment.setState({ last: 'summary' }));
    expect(useMoneySegment.getState().last).toBe('entries');
  });

  it('goals', async () => {
    let id = '';
    await roundTrip(
      () => {
        id = useGoals.getState().addGoal({ name: 'Bike', icon: 'flag', savedPaise: 0, targetPaise: 5000000, by: 'Dec', allocations: [] });
      },
      () => useGoals.setState({ goals: initialGoals() }),
    );
    expect(useGoals.getState().goals[0]).toMatchObject({ id, name: 'Bike' });
  });

  it('budget', async () => {
    await roundTrip(
      () => useBudget.getState().save({ totalPaise: 123400, limits: { Food: 5000 }, nudge: '80', rollover: false }),
      () => useBudget.getState().reset(),
    );
    expect(useBudget.getState()).toMatchObject({ totalPaise: 123400, limits: { Food: 5000 }, nudge: '80', rollover: false });
  });

  it('theme and language preference', async () => {
    await roundTrip(
      () => {
        usePreferences.getState().setTheme('dark');
        usePreferences.getState().setLocale('hi');
      },
      () => usePreferences.setState({ theme: 'system', locale: 'en' }),
    );
    expect(usePreferences.getState()).toMatchObject({ theme: 'dark', locale: 'hi' });
  });
});

describe('hydration gate and theme preference', () => {
  it('useHydrated turns true once stores have loaded', async () => {
    const { result } = renderHook(() => useHydrated());
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('ThemeProvider honours the stored preference over the OS scheme', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      <ThemeProvider preference="dark">{children}</ThemeProvider>;
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.dark).toBe(true);
  });
});
